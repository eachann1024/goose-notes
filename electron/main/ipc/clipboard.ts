import { clipboard, ipcMain, nativeImage } from "electron";
import { printHtmlToPdf } from "../printPdf";
import { isNetFetchAllowed } from "./common";

export function registerClipboardIpc(): void {
  ipcMain.handle("desktop:writeText", async (_event, t: string) => {
    clipboard.writeText(t ?? "");
  });

  ipcMain.handle("desktop:writeImage", async (_event, dataUrl: string) => {
    const trimmed = String(dataUrl ?? "").trim();
    const match = /^data:image\/[^;]+;base64,(.+)$/i.exec(trimmed);
    if (!match) {
      throw new Error("无效 PNG data URL");
    }
    const pngBuffer = Buffer.from(match[1], "base64");
    if (!pngBuffer.length) {
      throw new Error("无效 PNG data URL");
    }
    const image = nativeImage.createFromBuffer(pngBuffer);
    if (process.platform === "darwin") {
      clipboard.writeBuffer("public.png", pngBuffer);
      clipboard.writeImage(image);
    } else {
      clipboard.writeImage(image);
    }
  });

  ipcMain.handle("desktop:readText", async () => clipboard.readText());

  ipcMain.handle("desktop:printHtmlToPdf", async (_event, html: string) => {
    return printHtmlToPdf(html);
  });

  ipcMain.handle(
    "desktop:netFetch",
    async (
      _event,
      url: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ) => {
      if (!isNetFetchAllowed(url)) {
        throw new Error("netFetch 仅允许 localhost/127.0.0.1 与 https");
      }
      const response = await fetch(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await response.text();
      return { status: response.status, headers, body };
    },
  );
}
