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
    utools: {
      showSaveDialog: () => {
        calls.push("utools-dialog");
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

test("uTools 导出写入下载目录并选中文件，不弹保存对话框", async () => {
  const previousWindow = globalThis.window;
  const previousFileReader = (globalThis as { FileReader?: unknown }).FileReader;
  const calls: string[] = [];
  const files = new Set<string>();
  (globalThis as { FileReader?: unknown }).FileReader = TestFileReader;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    utools: {
      getPath: (name: string) =>
        name === "downloads" ? "/Users/me/Downloads" : null,
      showSaveDialog: () => {
        calls.push("dialog");
        return "/tmp/should-not-run.md";
      },
      shellShowItemInFolder: (targetPath: string) => {
        calls.push(`utools-reveal:${targetPath}`);
        return true;
      },
    },
    gooseFs: {
      exists: () => false,
      existsAsync: async (targetPath: string) => files.has(targetPath),
      mkdir: () => true,
      writeFileAsync: async (targetPath: string) => {
        files.add(targetPath);
        calls.push(`write:${targetPath}`);
        return true;
      },
      writeFile: () => false,
      revealItemInFolder: async (targetPath: string) => {
        calls.push(`reveal:${targetPath}`);
        return true;
      },
    },
  };

  try {
    await expect(
      saveBlobAndReveal(new Blob(["hello"]), "note.md"),
    ).resolves.toBe(true);
    expect(calls).toEqual([
      "write:/Users/me/Downloads/note.md",
      "reveal:/Users/me/Downloads/note.md",
    ]);
  } finally {
    (globalThis as typeof globalThis & { window: unknown }).window =
      previousWindow;
    (globalThis as { FileReader?: unknown }).FileReader = previousFileReader;
  }
});

test("uTools 下载目录已有同名文件时自动加序号", async () => {
  const previousWindow = globalThis.window;
  const previousFileReader = (globalThis as { FileReader?: unknown }).FileReader;
  const calls: string[] = [];
  const files = new Set(["/Users/me/Downloads/note.md"]);
  (globalThis as { FileReader?: unknown }).FileReader = TestFileReader;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    utools: {
      getPath: (name: string) =>
        name === "downloads" ? "/Users/me/Downloads" : null,
    },
    gooseFs: {
      exists: () => false,
      existsAsync: async (targetPath: string) => files.has(targetPath),
      mkdir: () => true,
      writeFileAsync: async (targetPath: string) => {
        files.add(targetPath);
        calls.push(`write:${targetPath}`);
        return true;
      },
      writeFile: () => false,
      revealItemInFolder: async (targetPath: string) => {
        calls.push(`reveal:${targetPath}`);
        return true;
      },
    },
  };

  try {
    await expect(
      saveBlobAndReveal(new Blob(["hello"]), "note.md"),
    ).resolves.toBe(true);
    expect(calls).toEqual([
      "write:/Users/me/Downloads/note (1).md",
      "reveal:/Users/me/Downloads/note (1).md",
    ]);
  } finally {
    (globalThis as typeof globalThis & { window: unknown }).window =
      previousWindow;
    (globalThis as { FileReader?: unknown }).FileReader = previousFileReader;
  }
});
