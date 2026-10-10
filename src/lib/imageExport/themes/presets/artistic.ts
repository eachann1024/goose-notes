import type { CardTheme } from "../types";
import { ARTISTIC_READING } from "./artisticReading";
import { ARTISTIC_EXPRESSIVE } from "./artisticExpressive";

export const ARTISTIC_THEMES: CardTheme[] = [
  ...ARTISTIC_READING,
  ...ARTISTIC_EXPRESSIVE,
];
