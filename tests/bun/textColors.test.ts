import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  TEXT_COLORS,
  documentTextColors,
  textColorsOnSurface,
} from "../../src/lib/textColors";
import { HTML_THEME } from "../../src/agent/renderers/htmlWidget/designSystem";
import { CARD_THEMES } from "../../src/lib/imageExport/themes/presets";
import { resolveAccentRuntimeTokens } from "../../src/lib/accentColor";
import { ACCENT_COLORS } from "../../src/stores/settings/types";
import {
  encodeLocalBlockPropsWrappers,
  restoreBlockPropsMarkers,
  unwrapLocalBlockPropsWrappers,
  wrapLocalBlockPropsMarkdown,
} from "../../src/lib/export/markdown/blockPropsMarker";

function luminance(hex: string) {
  const linear = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const v = parseInt(part, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

test("small text roles remain readable on application and widget surfaces", () => {
  const backgrounds = {
    light: ["#ffffff", "#f1f1f1", "#e3e1d5", "#f3f2f1"],
    dark: ["#14161b", "#1c1f24", "#24272e", "#2e2e2d", "#3a3a38"],
  };
  for (const theme of ["light", "dark"] as const) {
    for (const role of [
      "primary",
      "secondary",
      "disabled",
      "danger",
      "warning",
      "success",
      "info",
    ] as const) {
      for (const bg of backgrounds[theme])
        expect(contrast(TEXT_COLORS[theme][role], bg)).toBeGreaterThanOrEqual(
          4.5,
        );
    }
  }
});

test("named document text retains its hue and contrast on its highlight background", async () => {
  const css = await readFile(
    "src/pages/workspace/styles/block-background.css",
    "utf8",
  );
  const [light, dark] = css.split(/\.dark\s*\{/);
  for (const [theme, source] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    const colors = documentTextColors(theme);
    for (const [name, color] of Object.entries(colors)) {
      const bg = source.match(
        new RegExp(`--goose-editor-highlight-${name}-bg: (#[\\da-fA-F]+);`),
      )![1];
      expect(contrast(color, bg)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("diagram labels remain readable on every categorical surface", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const name of [
      "purple",
      "teal",
      "coral",
      "pink",
      "blue",
      "gray",
      "green",
      "amber",
      "red",
    ] as const) {
      const background = HTML_THEME[theme][name];
      for (const ink of Object.values(textColorsOnSurface(background))) {
        expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test("all appearance presets keep shared text readable on their actual surfaces", () => {
  for (const accent of ACCENT_COLORS) {
    for (const theme of ["light", "dark"] as const) {
      const tokens = resolveAccentRuntimeTokens(accent, theme === "dark");
      expect(tokens["--goose-interactive-selected-fg"]).toBe(
        "var(--goose-text-primary)",
      );
      expect(tokens["--goose-interactive-hover-fg"]).toBe(
        "var(--goose-text-primary)",
      );
      expect(tokens["--goose-inline-code-fg"]).toBe("var(--goose-text-info)");
      for (const surface of [
        "--goose-interactive-selected",
        "--goose-interactive-hover",
      ])
        expect(
          contrast(TEXT_COLORS[theme].primary, tokens[surface]),
        ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(TEXT_COLORS[theme].info, tokens["--goose-inline-code-bg"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});

function surfaceColors(value: string, bases: string[]): string[] {
  const hex = value.match(/^#[\da-f]{6}$/i);
  if (hex) return [value];
  const rgba = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba) {
    const alpha = Number(rgba[4]);
    return bases.map(
      (base) =>
        "#" +
        base
          .slice(1)
          .match(/../g)!
          .map((channel, index) =>
            Math.round(
              Number(rgba[index + 1]) * alpha +
                parseInt(channel, 16) * (1 - alpha),
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
    );
  }
  return value.match(/#[\da-f]{6}/gi) ?? bases;
}

test("export body, small captions and links are readable across all retained card themes", () => {
  for (const theme of CARD_THEMES) {
    const bases = surfaceColors(theme.background, [
      theme.mode === "dark" ? "#14161b" : "#ffffff",
    ]);
    const cards = surfaceColors(theme.cardBg, bases);
    for (const background of cards) {
      for (const ink of [
        theme.textColor,
        theme.secondaryText,
        theme.watermark,
        TEXT_COLORS[theme.mode].info,
      ]) {
        expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const background of surfaceColors(theme.codeBg, cards)) {
      expect(
        contrast(theme.codeTextColor ?? theme.textColor, background),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("old and current local Markdown colors keep their meaning when read and rewritten", () => {
  for (const [name, oldColor] of [
    ["gray", "#9b9a97"],
    ["red", "#e03e3e"],
    ["yellow", "#dfab01"],
    ["#123456", "#123456"],
  ]) {
    const currentColor = documentTextColors("light")[name] ?? name;
    for (const color of [oldColor, currentColor]) {
      const wrapper = `<span data-goose-note-block-props="v1" style="display:block; text-align:center; color:${color}; background-color:#ddebf1">正文</span>`;
      const marked = unwrapLocalBlockPropsWrappers(wrapper);
      const blocks = restoreBlockPropsMarkers([
        {
          id: "paragraph",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: marked, styles: {} }],
          children: [],
        },
      ]);
      expect(blocks[0].props).toMatchObject({
        textColor: name,
        textAlignment: "center",
        backgroundColor: "blue",
      });
      const encoded = encodeLocalBlockPropsWrappers(blocks);
      const rewritten = wrapLocalBlockPropsMarkdown(encoded[0], "正文");
      expect(rewritten).toContain(`color:${currentColor}`);
      expect(unwrapLocalBlockPropsWrappers(rewritten)).toBe(marked);
    }
  }
});

test("ordinary styled spans keep their original document formatting", () => {
  const markdown = '<span style="color:#123456; font-weight:bold">正文</span>';
  expect(unwrapLocalBlockPropsWrappers(markdown)).toBe(markdown);
});
