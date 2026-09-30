import { test, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const mainEntry = path.resolve(repoRoot, "dist-electron/main/index.js");
const preloadEntry = path.resolve(repoRoot, "dist-electron/preload/index.cjs");

const RENDERER_URL = "http://127.0.0.1:6017";
const SHUTDOWN_TIMEOUT_MS = 15_000;

interface TestHarness {
  rootDir: string;
  profileDir: string;
  notesDir: string;
  entryScriptPath: string;
  aFilePath: string;
  bFilePath: string;
}

async function prepareTestHarness(): Promise<TestHarness> {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "goose-electron-persistence-"),
  );
  const profileDir = path.join(rootDir, "profile");
  const notesDir = path.join(rootDir, "notes");
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(notesDir, { recursive: true });

  const aFilePath = path.join(notesDir, "A.md");
  const bFilePath = path.join(notesDir, "B.md");
  await fs.writeFile(aFilePath, "# A\n\nseed\n", "utf8");
  await fs.writeFile(bFilePath, "# B\n\nuntouched\n", "utf8");

  const vaultRootsPath = path.join(profileDir, "vault-roots.json");
  await fs.writeFile(
    vaultRootsPath,
    JSON.stringify([path.resolve(notesDir)], null, 2),
    "utf8",
  );

  const entryScriptPath = path.join(rootDir, "entry.mjs");
  const entryScriptContent = `import { app } from "electron";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const targetUserData = process.env.TEST_USER_DATA;
if (!targetUserData) {
  throw new Error("Missing TEST_USER_DATA env var");
}

app.setPath("userData", targetUserData);
app.setPath("sessionData", targetUserData);
assert.equal(app.getPath("userData"), targetUserData);
assert.equal(app.getPath("sessionData"), targetUserData);

const mainEntry = process.env.TEST_MAIN_ENTRY;
if (!mainEntry) {
  throw new Error("Missing TEST_MAIN_ENTRY env var");
}

await import(pathToFileURL(mainEntry).href);
`;
  await fs.writeFile(entryScriptPath, entryScriptContent, "utf8");

  return {
    rootDir,
    profileDir,
    notesDir,
    entryScriptPath,
    aFilePath,
    bFilePath,
  };
}

async function launchApp(harness: TestHarness): Promise<ElectronApplication> {
  try {
    await fs.access(mainEntry);
    await fs.access(preloadEntry);
  } catch {
    throw new Error(
      `Missing build output at ${mainEntry} or ${preloadEntry}. Run "bun run build:electron" before running electron tests.`,
    );
  }

  const electronApp = await electron.launch({
    args: [harness.entryScriptPath],
    env: {
      ...process.env,
      TEST_USER_DATA: harness.profileDir,
      TEST_MAIN_ENTRY: mainEntry,
      ELECTRON_RENDERER_URL: RENDERER_URL,
      NODE_ENV: "development",
    },
  });

  const appUserData = await electronApp.evaluate(({ app }) => {
    return app.getPath("userData");
  });
  assert.equal(appUserData, harness.profileDir);

  return electronApp;
}

async function waitForExit(
  electronApp: ElectronApplication,
  timeoutMs: number,
): Promise<void> {
  const childProcess = electronApp.process();

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      childProcess.once("exit", (code, signal) => {
        resolve({ code, signal });
      });
    },
  );

  await electronApp.evaluate(({ app }) => {
    setTimeout(() => {
      app.quit();
    }, 0);
  });

  let timeoutTimer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for Electron process to exit gracefully`,
        ),
      );
    }, timeoutMs);
  });

  try {
    const { code, signal } = await Promise.race([exitPromise, timeoutPromise]);
    if (signal) {
      throw new Error(`Electron process was killed by signal: ${signal}`);
    }
    if (code !== 0 && code !== null) {
      throw new Error(`Electron process exited with non-zero code: ${code}`);
    }
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}

test("真实磁盘持久化回归测试：零主动flush退出与数据落盘验证", async () => {
  const harness = await prepareTestHarness();
  console.log(`[test:persistence] Test workspace: ${harness.rootDir}`);

  let appInstance: ElectronApplication | null = null;

  try {
    appInstance = await launchApp(harness);

    const firstWindow = await appInstance.firstWindow();
    await firstWindow.waitForLoadState("domcontentloaded");

    const pageIds = await firstWindow.evaluate(
      async ({ notesPath }) => {
        // @ts-expect-error browser runtime import from vite dev server root
        const { useNotebooks } = await import("/src/stores/useNotebooks.ts");
        // @ts-expect-error browser runtime import from vite dev server root
        const { usePages } = await import("/src/stores/usePages.ts");

        const notebookId = useNotebooks
          .getState()
          .createLocalFolderNotebook("E2E", notesPath);
        await usePages
          .getState()
          .loadLocalFolderPages(notebookId, notesPath, { showWelcome: false });

        const pages: Record<string, { localFilePath?: string }> =
          usePages.getState().pages;
        let idA = "";
        let idB = "";

        for (const [id, page] of Object.entries(pages)) {
          if (page.localFilePath?.endsWith("A.md")) {
            idA = id;
          } else if (page.localFilePath?.endsWith("B.md")) {
            idB = id;
          }
        }

        return { idA, idB };
      },
      { notesPath: harness.notesDir },
    );

    expect(pageIds.idA).toBeTruthy();
    expect(pageIds.idB).toBeTruthy();

    const sidebarItemA = firstWindow
      .locator(`[data-rct-item-id="${pageIds.idA}"]`)
      .first();
    const sidebarItemB = firstWindow
      .locator(`[data-rct-item-id="${pageIds.idB}"]`)
      .first();

    await sidebarItemA.click();

    const paragraphLocator = firstWindow
      .locator(".bn-block-content[data-content-type='paragraph']")
      .filter({ hasText: "seed" })
      .first();
    await paragraphLocator.waitFor({ state: "visible" });
    await paragraphLocator.click();

    await firstWindow.keyboard.press("End");
    await firstWindow.keyboard.type("X");

    await sidebarItemB.click();
    await sidebarItemA.click();

    const seedXLocator = firstWindow
      .locator(".bn-block-content[data-content-type='paragraph']")
      .filter({ hasText: "seedX" })
      .first();
    await seedXLocator.waitFor({ state: "visible" });
    await seedXLocator.click();

    await firstWindow.keyboard.press("End");
    await firstWindow.keyboard.type("Y");

    const appToClose = appInstance;
    appInstance = null;
    await waitForExit(appToClose, SHUTDOWN_TIMEOUT_MS);

    const actualContentA = await fs.readFile(harness.aFilePath, "utf8");
    const actualContentB = await fs.readFile(harness.bFilePath, "utf8");

    expect(actualContentA).toBe("# A\n\nseedXY\n");
    expect(actualContentB).toBe("# B\n\nuntouched\n");

    const restartedApp = await launchApp(harness);
    appInstance = restartedApp;

    const restartedWindow = await restartedApp.firstWindow();
    await restartedWindow.waitForLoadState("domcontentloaded");

    const reopenedParagraph = restartedWindow
      .locator(".bn-block-content[data-content-type='paragraph']")
      .filter({ hasText: "seedXY" })
      .first();
    await expect(reopenedParagraph).toBeVisible();

    const appToShutdownFinally = appInstance;
    appInstance = null;
    await waitForExit(appToShutdownFinally, SHUTDOWN_TIMEOUT_MS);
  } finally {
    if (appInstance) {
      try {
        const proc = appInstance.process();
        if (proc && !proc.killed) {
          proc.kill("SIGTERM");
        }
      } catch {
        // cleanup only
      }
    }
  }
});
