import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortcut(shortcut: string) {
  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return shortcut
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "mod") return isMac ? "⌘" : "Ctrl";
      if (p === "alt") return isMac ? "⌥" : "Alt";
      if (p === "shift") return isMac ? "⇧" : "Shift";
      if (p === "enter") return "↵";
      if (p === "backspace") return "⌫";
      if (p === "tab") return "⇥";
      if (p === "up") return "↑";
      if (p === "down") return "↓";
      return part.trim();
    })
    .join(isMac ? "" : " + ");
}
