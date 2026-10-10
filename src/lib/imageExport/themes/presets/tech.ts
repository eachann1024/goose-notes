import type { CardTheme } from "../types";
import { TECH_DOCUMENT } from "./techDocument";
import { TECH_APPLICATION } from "./techApplication";

export const TECH_THEMES: CardTheme[] = [
  ...TECH_DOCUMENT,
  ...TECH_APPLICATION,
];
