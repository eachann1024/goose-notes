import type { CardTheme } from "./types";
import { TECH_THEMES } from "./presets/tech";
import { ARTISTIC_THEMES } from "./presets/artistic";
import { COLORFUL_THEMES } from "./presets/colorful";

// Helper to find a theme by id from category sheets
const findTheme = (id: string): CardTheme => {
  const all = [...TECH_THEMES, ...ARTISTIC_THEMES, ...COLORFUL_THEMES];
  const found = all.find((t) => t.id === id);
  if (!found) throw new Error(`Theme ${id} not found in presets!`);
  return found;
};

export const CARD_THEMES: CardTheme[] = [
  findTheme("notion"),
  findTheme("obsidian"),
  findTheme("medium"),
  findTheme("kenya-hara"),
  findTheme("typewriter"),
  findTheme("neon"),
  findTheme("academic"),
  findTheme("stationery"),
  findTheme("poster"),
  findTheme("github-light"),
  findTheme("github-dark"),
  findTheme("vercel-dark"),
  findTheme("tokyo-night"),
  findTheme("catppuccin"),
  findTheme("synthwave"),
  findTheme("linear"),
  findTheme("mocha-mousse"),
  findTheme("solarized-light"),
  findTheme("brutalist"),
  findTheme("risograph"),
];

export type CardThemeId = (typeof CARD_THEMES)[number]["id"];

export function getCardTheme(themeId: CardThemeId): CardTheme {
  return CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
}
