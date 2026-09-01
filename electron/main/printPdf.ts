import { app, BrowserWindow } from "electron";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

let printChain: Promise<unknown> = Promise.resolve();

function enqueuePrint<T>(fn: () => Promise<T>): Promise<T> {
  const next = printChain.then(fn, fn);
  printChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function waitPrintDocumentReady(
  webContents: Electron.WebContents,
  timeoutMs = 8000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ready = await webContents.executeJavaScript(
        "Boolean(window.__GOOSE_PRINT_READY__ === true)",
      );
      if (ready) return;
    } catch {
      // 导航中
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function printHtmlToPdf(html: string): Promise<string | null> {
  if (typeof html !== "string" || !html.trim()) return null;

  return enqueuePrint(async () => {
    const tempDir = path.join(app.getPath("temp"), "goose-note-print");
    const htmlPath = path.join(tempDir, `print-${Date.now()}.html`);
    await mkdir(tempDir, { recursive: true });
    await writeFile(htmlPath, html, "utf8");
    const fileUrl = pathToFileURL(htmlPath).href;

    try {
      return await new Promise<string | null>((resolve, reject) => {
        let settled = false;
        let win: BrowserWindow | null = null;

        const finish = (error: Error | null, value: string | null) => {
          if (settled) return;
          settled = true;
          try {
            win?.close();
          } catch {
            // ignore
          }
          win = null;
          if (error) reject(error);
          else resolve(value);
        };

        const runPrint = async () => {
          try {
            const webContents = win?.webContents;
            if (!webContents || webContents.isDestroyed()) {
              finish(null, null);
              return;
            }
            await webContents.loadURL(fileUrl);
            await waitPrintDocumentReady(webContents);
            const data = await webContents.printToPDF({
              printBackground: true,
              preferCSSPageSize: true,
            });
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
            if (!buf.length) {
              finish(new Error("printToPDF 返回空内容"), null);
              return;
            }
            finish(null, buf.toString("base64"));
          } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)), null);
          }
        };

        win = new BrowserWindow({
          show: false,
          width: 820,
          height: 1169,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
          },
        });

        win.webContents.once("did-finish-load", () => {
          void runPrint();
        });

        setTimeout(() => finish(new Error("printToPDF 超时"), null), 20000);
      });
    } finally {
      try {
        await unlink(htmlPath);
      } catch {
        // ignore
      }
    }
  });
}
