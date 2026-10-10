import { app, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertAllowed, userDataRoot } from "../allowlist";
import { listOpenApps, openTerminalAtPath, openWithApp } from "../apps";
import { saveToDownloads } from "../saveToDownloads";
import { isOpenUrlAllowed } from "./common";

const execFileAsync = promisify(execFile);

export function registerIntegrationIpc(): void {
  ipcMain.handle("desktop:getUserDataPath", async () => userDataRoot());

  ipcMain.handle("desktop:getDownloadsPath", async () =>
    app.getPath("downloads"),
  );

  ipcMain.handle(
    "desktop:saveToDownloads",
    async (_event, filename: string, data: Uint8Array) => {
      return saveToDownloads(filename, data);
    },
  );

  ipcMain.handle("desktop:joinPath", async (_event, parts: string[]) => {
    return path.join(...parts);
  });

  ipcMain.handle("desktop:openUrl", async (_event, url: string) => {
    if (!isOpenUrlAllowed(url)) {
      throw new Error("只允许打开 http/https 链接");
    }
    await shell.openExternal(url);
  });

  ipcMain.handle("desktop:openPath", async (_event, p: string) => {
    const target = assertAllowed(p);
    const err = await shell.openPath(target);
    if (err) throw new Error(err);
  });

  ipcMain.handle("desktop:showItemInFolder", async (_event, p: string) => {
    const target = assertAllowed(p);
    shell.showItemInFolder(target);
  });

  ipcMain.handle(
    "desktop:listOpenApps",
    async (_event, requestedNames: string[]) => {
      if (
        !Array.isArray(requestedNames) ||
        requestedNames.length > 100 ||
        requestedNames.some(
          (name) => typeof name !== "string" || name.length > 100,
        )
      ) {
        throw new Error("无效的应用列表");
      }
      const names = new Set(requestedNames.map((name) => name.toLowerCase()));
      const found = (await listOpenApps()).filter(
        (item) =>
          names.has(item.name.toLowerCase()) ||
          names.has(
            path
              .basename(item.path)
              .replace(/\.(app|exe)$/i, "")
              .toLowerCase(),
          ),
      );
      if (process.platform === "darwin" && found.length) {
        try {
          const script =
            'function run(paths) { ObjC.import("AppKit"); return JSON.stringify(paths.map(p => { try { const image = $.NSWorkspace.sharedWorkspace.iconForFile($(p)); const bitmap = $.NSBitmapImageRep.alloc.initWithData(image.TIFFRepresentation); const png = bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})); return ObjC.unwrap(png.base64EncodedStringWithOptions(0)); } catch (_) { return null; } })); }';
          const { stdout } = await execFileAsync(
            "/usr/bin/osascript",
            [
              "-l",
              "JavaScript",
              "-e",
              script,
              ...found.map((item) => item.path),
            ],
            {
              encoding: "utf8",
              maxBuffer: 32 * 1024 * 1024,
              timeout: 15000,
            },
          );
          const encoded = JSON.parse(stdout) as (string | null)[];
          return found.map((item, index) => {
            const image = encoded[index]
              ? nativeImage.createFromBuffer(
                  Buffer.from(encoded[index], "base64"),
                )
              : null;
            return image && !image.isEmpty()
              ? {
                  ...item,
                  icon: image.resize({ width: 32, height: 32 }).toDataURL(),
                }
              : item;
          });
        } catch (error) {
          console.warn("[apps] macOS 应用图标读取失败", error);
          return found;
        }
      }
      return Promise.all(
        found.map(async (item) => {
          try {
            const icon = await app.getFileIcon(item.path, { size: "small" });
            return { ...item, icon: icon.toDataURL() };
          } catch {
            return item;
          }
        }),
      );
    },
  );

  ipcMain.handle(
    "desktop:openWithApp",
    async (_event, appName: string, p: string) => {
      const target = assertAllowed(p);
      if (!openWithApp(appName, target)) {
        throw new Error("无法用指定应用打开");
      }
    },
  );

  ipcMain.handle(
    "desktop:openTerminalAtPath",
    async (_event, p: string, terminal?: string) => {
      const target = assertAllowed(p);
      if (
        !openTerminalAtPath(
          target,
          typeof terminal === "string" ? terminal : undefined,
        )
      ) {
        throw new Error("无法在该路径打开终端");
      }
    },
  );
}
