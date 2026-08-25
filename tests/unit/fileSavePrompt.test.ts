import { expect, test } from "playwright/test";
import {
  nextAvailableFilename,
  saveBlobWithPrompt,
} from "../../src/lib/export/fileSave";

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


test("saveBlobWithPrompt treats closing the system dialog as cancellation", async () => {
  const previousWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    utools: {
      showSaveDialog: () => ({ canceled: true }),
    },
    gooseFs: {},
  };

  try {
    await expect(
      saveBlobWithPrompt(new Blob(["backup"]), "backup.zip"),
    ).resolves.toBe("cancelled");
  } finally {
    (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
  }
});
