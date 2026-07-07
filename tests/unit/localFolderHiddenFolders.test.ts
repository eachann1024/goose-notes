import { expect, test } from "playwright/test";
import { shouldIgnoreEntry } from "../../src/lib/local-folder-scanner";

test.describe("local-folder-scanner shouldIgnoreEntry", () => {
  test("ignores dot folders", () => {
    const hidden = new Set<string>();
    expect(shouldIgnoreEntry(".git", hidden)).toBe(true);
    expect(shouldIgnoreEntry(".obsidian", hidden)).toBe(true);
  });

  test("ignores built-in ignored folders", () => {
    const hidden = new Set<string>();
    expect(shouldIgnoreEntry("node_modules", hidden)).toBe(true);
    expect(shouldIgnoreEntry("dist", hidden)).toBe(true);
  });

  test("ignores user-configured hidden folders", () => {
    const hidden = new Set(["assets", "obsidian"]);
    expect(shouldIgnoreEntry("assets", hidden)).toBe(true);
    expect(shouldIgnoreEntry("obsidian", hidden)).toBe(true);
  });

  test("keeps non-hidden folders", () => {
    const hidden = new Set(["assets"]);
    expect(shouldIgnoreEntry("visible", hidden)).toBe(false);
    expect(shouldIgnoreEntry("notes", hidden)).toBe(false);
  });
});
