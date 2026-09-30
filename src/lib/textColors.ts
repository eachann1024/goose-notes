import palette from "@/styles/text-colors.json" with { type: "json" };

/** Shared by DOM text, canvas labels, generated widgets and document exports. */
export const TEXT_COLORS = palette;
export type TextColorTheme = keyof typeof TEXT_COLORS;
type TextColorRole = Exclude<
  keyof (typeof TEXT_COLORS)["light"],
  "documentText"
>;

function luminance(hex: string): number {
  const linear = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Colored diagram surfaces still use the common ink roles at readable contrast. */
export function textColorsOnSurface(background: string) {
  const surface = luminance(background);
  const contrast = (color: string) => {
    const ink = luminance(color);
    return (Math.max(surface, ink) + 0.05) / (Math.min(surface, ink) + 0.05);
  };
  let theme: TextColorTheme =
    contrast(TEXT_COLORS.light.primary) >= contrast(TEXT_COLORS.dark.primary)
      ? "light"
      : "dark";
  let primary: string = TEXT_COLORS[theme].primary;
  if (contrast(primary) < 4.5) {
    theme =
      contrast(TEXT_COLORS.light.onLight) >= contrast(TEXT_COLORS.dark.onDark)
        ? "light"
        : "dark";
    primary =
      theme === "light" ? TEXT_COLORS.light.onLight : TEXT_COLORS.dark.onDark;
  }
  const roles = TEXT_COLORS[theme];
  return {
    primary,
    secondary: contrast(roles.secondary) >= 4.5 ? roles.secondary : primary,
  };
}

export function documentTextColors(
  theme: TextColorTheme,
): Record<string, string> {
  const roles = TEXT_COLORS[theme];
  return Object.fromEntries(
    Object.entries(roles.documentText).map(([name, value]) => [
      name,
      value.startsWith("$") ? roles[value.slice(1) as TextColorRole] : value,
    ]),
  );
}

function hslChannels(hex: string): string {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
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

export function textColorVariables(theme: TextColorTheme): string {
  const roles = TEXT_COLORS[theme];
  const values = Object.entries(roles)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(
      ([role, color]) =>
        `--goose-text-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${color};`,
    );
  for (const [name, color] of Object.entries(documentTextColors(theme)))
    values.push(`--goose-editor-highlight-${name}-text: ${color};`);
  values.push(
    `--goose-text-primary-channels: ${hslChannels(roles.primary)};`,
    `--goose-text-secondary-channels: ${hslChannels(roles.secondary)};`,
    `--goose-text-on-dark-channels: ${hslChannels(roles.onDark)};`,
    `--goose-text-on-light-channels: ${hslChannels(roles.onLight)};`,
  );
  return values.join("\n");
}
