import { expect, test } from "playwright/test";

const LOCAL_DIR = "/mock-trip";
const LOCAL_FILE = `${LOCAL_DIR}/guide.md`;

const SAMPLE_MARKDOWN = `攻略

<details>
<summary>步行</summary>

广东省博物馆

圣心大教堂

植物园

长洲岛

<!-- 图片: IMG_7788.jpeg -->

</details>

<details>
<summary>吃饭</summary>

东圃湿辣牛肉

- [ ] 大鸽饭
- [ ] 农讲所布丁包

</details>`;

async function installMockLocalFs(page: import("playwright/test").Page) {
  await page.addInitScript(
    ({ dirPath, filePath, markdown }) => {
      type MockFile = { content: string; mtime: number };

      const files = new Map<string, MockFile>([
        [filePath, { content: markdown, mtime: Date.now() }],
      ]);
      const writes: Array<{ path: string; content: string; at: number }> = [];

      const readText = (path: string) => files.get(path)?.content ?? null;
      const listEntries = (path: string) => {
        if (path !== dirPath) return [];
        return [
          {
            name: "guide.md",
            isFile: true,
            isDirectory: false,
            path: filePath,
          },
        ];
      };

      const writeText = (path: string, content: string) => {
        const file = files.get(path);
        if (!file) return false;
        writes.push({ path, content, at: Date.now() });
        file.content = content;
        file.mtime = Date.now();
        return true;
      };

      (window as Window & { __gooseFsMock?: unknown }).__gooseFsMock = {
        snapshot: () => {
          const file = files.get(filePath);
          return {
            content: file?.content ?? "",
            mtime: file?.mtime ?? 0,
            writeCount: writes.length,
          };
        },
      };

      (window as any).gooseFs = {
        selectDirectory: async () => dirPath,
        exists: () => true,
        existsAsync: async () => true,
        readDir: (path: string) => listEntries(path),
        readDirAsync: async (path: string) => listEntries(path),
        readFile: (path: string) => readText(path),
        readFileAsync: async (path: string) => readText(path),
        writeFile: (path: string, content: string) => writeText(path, content),
        writeFileAsync: async (path: string, content: string) =>
          writeText(path, content),
        mkdir: async () => true,
        watch: () => {},
        unwatch: () => {},
        deleteFile: async () => false,
        deleteDir: async () => false,
        rename: async () => true,
      };
    },
    {
      dirPath: LOCAL_DIR,
      filePath: LOCAL_FILE,
      markdown: SAMPLE_MARKDOWN,
    },
  );
}

test("打开含 details 的本地 Markdown 不应空白且不改写源文件", async ({
  page,
}) => {
  await installMockLocalFs(page);
  await page.goto("/");

  const before = await page.evaluate(
    () => (window as any).__gooseFsMock.snapshot() as {
      content: string;
      mtime: number;
      writeCount: number;
    },
  );

  await page.evaluate(async ({ dirPath }) => {
    const { useNotebooks } = await import("/src/stores/useNotebooks.ts");
    const { usePages } = await import("/src/stores/usePages.ts");

    const notebookId = useNotebooks
      .getState()
      .createLocalFolderNotebook("mock-trip", dirPath);
    useNotebooks.getState().setActiveNotebook(notebookId);
    await usePages
      .getState()
      .loadLocalFolderPages(notebookId, dirPath, { showWelcome: true });

    const localPages = Object.values(usePages.getState().pages).filter(
      (item: any) =>
        item.workspaceId === notebookId &&
        !item.isFolder &&
        typeof item.localFilePath === "string" &&
        item.localFilePath.endsWith(".md"),
    ) as Array<{ id: string }>;

    if (!localPages.length) {
      throw new Error("local markdown page not loaded");
    }

    await usePages.getState().setActivePage(localPages[0].id);
  }, { dirPath: LOCAL_DIR });

  await expect
    .poll(async () => {
      return await page.evaluate(async () => {
        const { usePages } = await import("/src/stores/usePages.ts");
        const state = usePages.getState();
        const activeId = state.activePageId;
        if (!activeId) return "";
        const page = state.pages[activeId];
        return page?.localFilePath || "";
      });
    })
    .toBe(LOCAL_FILE);

  await expect(page.locator(".ProseMirror").first()).toBeVisible();
  await expect(page.locator(".ProseMirror").first()).toContainText("广东省博物馆");
  await expect(page.locator(".ProseMirror").first()).toContainText("大鸽饭");

  await page.waitForTimeout(1600);
  await page.evaluate(async () => {
    const { usePages } = await import("/src/stores/usePages.ts");
    await usePages.getState().flushPendingLocalSaves();
  });

  const after = await page.evaluate(
    () => (window as any).__gooseFsMock.snapshot() as {
      content: string;
      mtime: number;
      writeCount: number;
    },
  );

  expect(after.content).toBe(before.content);
  expect(after.mtime).toBe(before.mtime);
  expect(after.writeCount).toBe(0);
});
