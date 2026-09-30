import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  defaultFontValueForMode,
  getDefaultFontMode,
} from "../../src/pages/workspace/components/shared/DefaultFontSelect";

const source = readFileSync(new URL("../../src/pages/workspace/components/shared/DefaultFontSelect.tsx", import.meta.url), "utf8");

describe("DefaultFontSelect", () => {
  test("preserves the stored values for built-in fonts", () => {
    for (const [mode, value] of [["system", null], ["serif", "serif"], ["mono", "monospace"]] as const) {
      expect(getDefaultFontMode(value)).toBe(mode);
      expect(defaultFontValueForMode(mode)).toBe(value);
    }
  });

  test("recognizes local font names without changing the stored font", () => {
    for (const font of ["Arial", "PingFang SC", "苹方-简"]) {
      expect(getDefaultFontMode(font)).toBe("custom");
    }
    expect(defaultFontValueForMode("custom")).toBeNull();
  });

  // Wiring guard only; real keyboard, focus, portal and theme behavior is checked with ego-browser.
  test("uses shared controls rather than a bespoke select or popup", () => {
    expect(source).toContain('from "@/components/ui/dropdown-menu"');
    expect(source).toContain("<DropdownMenuRadioGroup");
    expect(source).toContain("<DropdownMenuRadioItem");
    expect(source).toContain("<Button");
    expect(source).not.toMatch(/<select\b|onKeyDown=|createPortal/);
    expect(source).toContain("aria-labelledby={`${id}-label ${id}-value`}");
    expect(source).toContain('justify-between border-input px-3');
    expect(source).toContain('setModeOverride(font ? null : { value: null, mode: "custom" })');
  });
});
