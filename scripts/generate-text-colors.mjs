import { readFile, writeFile } from "node:fs/promises";
const palette = JSON.parse(
  await readFile(
    new URL("../src/styles/text-colors.json", import.meta.url),
    "utf8",
  ),
);
function channels(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const h = !d
    ? 0
    : ((max === r
        ? (g - b) / d
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4) *
        60 +
        360) %
      360;
  return `${h.toFixed(4)} ${(s * 100).toFixed(4)}% ${(l * 100).toFixed(4)}%`;
}
const aliases = {
  foreground: "primary",
  "card-foreground": "primary",
  "popover-foreground": "primary",
  "secondary-foreground": "primary",
  "accent-foreground": "primary",
  "muted-foreground": "secondary",
  "goose-nav-title": "secondary",
};
let css =
  "/* Generated from text-colors.json by scripts/generate-text-colors.mjs. */\n";
for (const [theme, roles] of Object.entries(palette)) {
  const selectors =
    theme === "light"
      ? ':root, .light, .default, [data-theme="light"], [data-theme="default"]'
      : '.dark, [data-theme="dark"], [data-sonner-theme="dark"]';
  css += `${selectors} {\n`;
  for (const [role, color] of Object.entries(roles)) {
    if (typeof color === "string")
      css += `  --goose-text-${role.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${color};\n`;
  }
  for (const [name, value] of Object.entries(roles.documentText))
    css += `  --goose-editor-highlight-${name}-text: ${value.startsWith("$") ? `var(--goose-text-${value.slice(1)})` : value};\n`;
  css += `  --goose-text-primary-channels: ${channels(roles.primary)};\n  --goose-text-secondary-channels: ${channels(roles.secondary)};\n  --goose-text-on-dark-channels: ${channels(roles.onDark)};\n  --goose-text-on-light-channels: ${channels(roles.onLight)};\n`;
  for (const [alias, role] of Object.entries(aliases))
    css += `  --${alias}: var(--goose-text-${role}-channels);\n`;
  css +=
    "  --goose-text-placeholder: var(--goose-text-secondary);\n  --goose-text-link: var(--goose-text-info);\n  --goose-interactive-danger-fg: var(--goose-text-danger);\n  --goose-interactive-success-fg: var(--goose-text-success);\n  --goose-interactive-warning-fg: var(--goose-text-warning);\n}\n";
}
const output = new URL("../src/styles/goose-text-palette.css", import.meta.url);
if ((await readFile(output, "utf8").catch(() => "")) !== css)
  await writeFile(output, css);
