import { expect, test } from "playwright/test";
import {
  nextAvailableFilename,
  saveBlobAndReveal,
} from "../../src/lib/export/fileSave";

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: ((event?: unknown) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;

  async readAsDataURL(blob: Blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
    this.onloadend?.({ target: this });
  }
}

test("nextAvailableFilename keeps the name when the download is free", () => {
  expect(nextAvailableFilename("2026.08.html", () => false)).toBe(
    "2026.08.html",
  );
});

test("nextAvailableFilename suffixes when the download already exists", () => {
  const taken = new Set(["2026.08.html", "2026.08 (1).html"]);
  expect(nextAvailableFilename("2026.08.html", (name) => taken.has(name))).toBe(
    "2026.08 (2).html",
  );
});

test("Electron 导出写入下载目录并选中文件，不弹保存对话框", async () => {
  const previousWindow = globalThis.window;
  const calls: string[] = [];
  (globalThis as typeof globalThis & { window: unknown }).window = {
    gooseDesktop: {
      saveToDownloads: async (filename: string, data: Uint8Array) => {
        calls.push(`save:${filename}:${data.byteLength}`);
        return `/Users/me/Downloads/${filename}`;
      },
      showItemInFolder: async (targetPath: string) => {
        calls.push(`reveal:${targetPath}`);
      },
      showSaveDialog: async () => {
        calls.push("dialog");
        return "/tmp/should-not-run.html";
      },
    },
    electron: {
      showSaveDialog: () => {
        calls.push("electron-dialog");
        return "/tmp/should-not-run.html";
      },
    },
  };

  try {
    await expect(
      saveBlobAndReveal(new Blob(["hello"]), "note.md"),
    ).resolves.toBe(true);
    expect(calls).toEqual([
      "save:note.md:5",
      "reveal:/Users/me/Downloads/note.md",
    ]);
  } finally {
    (globalThis as typeof globalThis & { window: unknown }).window =
      previousWindow;
  }
});
