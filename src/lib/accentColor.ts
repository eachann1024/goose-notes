import { DEFAULT_ACCENT_COLOR, type AccentColor } from "@/stores/settings/types";

type AccentRuntimeTokens = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

/**
 * 运行时直接写入的强调色 token。
 * 侧栏选中与行内代码等关键表面依赖这些变量；仅靠 CSS 选择器时，
 * 旧内核 / 缓存 CSS 可能只命中部分 token，导致侧栏已跟随 accent、
 * 行内代码仍停在 .dark 的 iris fallback。
 * hover 与侧栏浅染底完全同步；图标和文字取同一强调前景。
 */
const ACCENT_RUNTIME_TOKENS: Record<AccentColor, AccentRuntimeTokens> = {
  iris: {
    light: {
      "--goose-interactive-selected": "#eceafa",
      "--goose-interactive-selected-fg": "#4c40a6",
      "--goose-interactive-selected-border": "#8174cb",
      "--goose-sidebar-hover": "#f3f1fb",
      "--goose-interactive-hover": "#f3f1fb",
      "--goose-interactive-hover-fg": "#4c40a6",
      "--goose-interactive-hover-border": "#8174cb",
      "--goose-inline-code-bg": "#eef2ff",
      "--goose-inline-code-fg": "#4f46e5",
      "--goose-inline-code-border-hover": "#c7d2fe",
      "--goose-editor-selection-bg": "#e0e7ff",
    },
    dark: {
      "--goose-interactive-selected": "#34304e",
      "--goose-interactive-selected-fg": "#c4baff",
      "--goose-interactive-selected-border": "#9484e5",
      "--goose-sidebar-hover": "#2c293d",
      "--goose-interactive-hover": "#2c293d",
      "--goose-interactive-hover-fg": "#c4baff",
      "--goose-interactive-hover-border": "#9484e5",
      "--goose-inline-code-bg": "#3d3e64",
      "--goose-inline-code-fg": "#c7d2fe",
      "--goose-inline-code-border-hover": "#6366f1",
      "--goose-editor-selection-bg": "rgba(99, 102, 241, 0.35)",
    },
  },
  ocean: {
    light: {
      "--goose-interactive-selected": "#e5edfc",
      "--goose-interactive-selected-fg": "#214fae",
      "--goose-interactive-selected-border": "#547dd0",
      "--goose-sidebar-hover": "#eef3fc",
      "--goose-interactive-hover": "#eef3fc",
      "--goose-interactive-hover-fg": "#214fae",
      "--goose-interactive-hover-border": "#547dd0",
      "--goose-inline-code-bg": "#eff6ff",
      "--goose-inline-code-fg": "#2563eb",
      "--goose-inline-code-border-hover": "#bfdbfe",
      "--goose-editor-selection-bg": "#dbeafe",
    },
    dark: {
      "--goose-interactive-selected": "#273750",
      "--goose-interactive-selected-fg": "#a8c8ff",
      "--goose-interactive-selected-border": "#779de8",
      "--goose-sidebar-hover": "#29313d",
      "--goose-interactive-hover": "#29313d",
      "--goose-interactive-hover-fg": "#a8c8ff",
      "--goose-interactive-hover-border": "#779de8",
      "--goose-inline-code-bg": "#324665",
      "--goose-inline-code-fg": "#bfdbfe",
      "--goose-inline-code-border-hover": "#3b82f6",
      "--goose-editor-selection-bg": "rgba(59, 130, 246, 0.35)",
    },
  },
  mono: {
    light: {
      "--goose-interactive-selected": "#fcfcf7",
      "--goose-interactive-selected-fg": "#2b2e2b",
      "--goose-interactive-selected-border": "#756b42",
      "--goose-sidebar-hover": "#e3e1d5",
      "--goose-interactive-hover": "#e3e1d5",
      "--goose-interactive-hover-fg": "#2b2e2b",
      "--goose-interactive-hover-border": "#756b42",
      "--goose-inline-code-bg": "#eeebde",
      "--goose-inline-code-fg": "#6b623d",
      "--goose-inline-code-border-hover": "#756b42",
      "--goose-editor-selection-bg": "#eeebde",
    },
    dark: {
      "--goose-interactive-selected": "#363636",
      "--goose-interactive-selected-fg": "#eeeeee",
      "--goose-interactive-selected-border": "#a0a0a0",
      "--goose-sidebar-hover": "#2f2f2f",
      "--goose-interactive-hover": "#2f2f2f",
      "--goose-interactive-hover-fg": "#eeeeee",
      "--goose-interactive-hover-border": "#a0a0a0",
      "--goose-inline-code-bg": "#3a3a3a",
      "--goose-inline-code-fg": "#f5f5f5",
      "--goose-inline-code-border-hover": "#737373",
      "--goose-editor-selection-bg": "rgba(255, 255, 255, 0.22)",
    },
  },
  pine: {
    light: {
      "--goose-interactive-selected": "#e4f1e8",
      "--goose-interactive-selected-fg": "#205d38",
      "--goose-interactive-selected-border": "#559369",
      "--goose-sidebar-hover": "#edf5ef",
      "--goose-interactive-hover": "#edf5ef",
      "--goose-interactive-hover-fg": "#205d38",
      "--goose-interactive-hover-border": "#559369",
      "--goose-inline-code-bg": "#f0fdf4",
      "--goose-inline-code-fg": "#15803d",
      "--goose-inline-code-border-hover": "#bbf7d0",
      "--goose-editor-selection-bg": "#dcfce7",
    },
    dark: {
      "--goose-interactive-selected": "#273e31",
      "--goose-interactive-selected-fg": "#a1dcb6",
      "--goose-interactive-selected-border": "#6aae83",
      "--goose-sidebar-hover": "#29342e",
      "--goose-interactive-hover": "#29342e",
      "--goose-interactive-hover-fg": "#a1dcb6",
      "--goose-interactive-hover-border": "#6aae83",
      "--goose-inline-code-bg": "#2b4a37",
      "--goose-inline-code-fg": "#bbf7d0",
      "--goose-inline-code-border-hover": "#22c55e",
      "--goose-editor-selection-bg": "rgba(34, 197, 94, 0.35)",
    },
  },
  amber: {
    light: {
      "--goose-interactive-selected": "#fffdf7",
      "--goose-interactive-selected-fg": "#544b38",
      "--goose-interactive-selected-border": "#c9b894",
      "--goose-sidebar-hover": "#e9dfc7",
      "--goose-interactive-hover": "#e9dfc7",
      "--goose-interactive-hover-fg": "#544b38",
      "--goose-interactive-hover-border": "#c9b894",
      "--goose-inline-code-bg": "#efe6cf",
      "--goose-inline-code-fg": "#74623a",
      "--goose-inline-code-border-hover": "#c9b894",
      "--goose-editor-selection-bg": "#e9dfc7",
    },
    dark: {
      "--goose-interactive-selected": "#39352a",
      "--goose-interactive-selected-fg": "#eee9dc",
      "--goose-interactive-selected-border": "#928365",
      "--goose-sidebar-hover": "#302d25",
      "--goose-interactive-hover": "#302d25",
      "--goose-interactive-hover-fg": "#eee9dc",
      "--goose-interactive-hover-border": "#928365",
      "--goose-inline-code-bg": "#39352a",
      "--goose-inline-code-fg": "#cfbf95",
      "--goose-inline-code-border-hover": "#928365",
      "--goose-editor-selection-bg": "#39352a",
    },
  },
  wheat: {
    light: {
      "--goose-interactive-selected": "#fcfbf3",
      "--goose-interactive-selected-fg": "#4d553b",
      "--goose-interactive-selected-border": "#aeb18e",
      "--goose-sidebar-hover": "#e0ddc8",
      "--goose-interactive-hover": "#e0ddc8",
      "--goose-interactive-hover-fg": "#4d553b",
      "--goose-interactive-hover-border": "#aeb18e",
      "--goose-inline-code-bg": "#e9e7d4",
      "--goose-inline-code-fg": "#636a45",
      "--goose-inline-code-border-hover": "#aeb18e",
      "--goose-editor-selection-bg": "#e0ddc8",
    },
    dark: {
      "--goose-interactive-selected": "#33382a",
      "--goose-interactive-selected-fg": "#e9ebdf",
      "--goose-interactive-selected-border": "#838d69",
      "--goose-sidebar-hover": "#2b3025",
      "--goose-interactive-hover": "#2b3025",
      "--goose-interactive-hover-fg": "#e9ebdf",
      "--goose-interactive-hover-border": "#838d69",
      "--goose-inline-code-bg": "#33382a",
      "--goose-inline-code-fg": "#bec59f",
      "--goose-inline-code-border-hover": "#838d69",
      "--goose-editor-selection-bg": "#33382a",
    },
  },
  coral: {
    light: {
      "--goose-interactive-selected": "#fbeadf",
      "--goose-interactive-selected-fg": "#983a19",
      "--goose-interactive-selected-border": "#b76e4a",
      "--goose-sidebar-hover": "#fcf2ec",
      "--goose-interactive-hover": "#fcf2ec",
      "--goose-interactive-hover-fg": "#983a19",
      "--goose-interactive-hover-border": "#b76e4a",
      "--goose-inline-code-bg": "#fff7ed",
      "--goose-inline-code-fg": "#c2410c",
      "--goose-inline-code-border-hover": "#fed7aa",
      "--goose-editor-selection-bg": "#ffedd5",
    },
    dark: {
      "--goose-interactive-selected": "#463128",
      "--goose-interactive-selected-fg": "#f4bc96",
      "--goose-interactive-selected-border": "#d28f68",
      "--goose-sidebar-hover": "#372c28",
      "--goose-interactive-hover": "#372c28",
      "--goose-interactive-hover-fg": "#f4bc96",
      "--goose-interactive-hover-border": "#d28f68",
      "--goose-inline-code-bg": "#4f3425",
      "--goose-inline-code-fg": "#fed7aa",
      "--goose-inline-code-border-hover": "#f97316",
      "--goose-editor-selection-bg": "rgba(249, 115, 22, 0.35)",
    },
  },
  rose: {
    light: {
      "--goose-interactive-selected": "#f8e7eb",
      "--goose-interactive-selected-fg": "#972446",
      "--goose-interactive-selected-border": "#c36a83",
      "--goose-sidebar-hover": "#fbf0f2",
      "--goose-interactive-hover": "#fbf0f2",
      "--goose-interactive-hover-fg": "#972446",
      "--goose-interactive-hover-border": "#c36a83",
      "--goose-inline-code-bg": "#fff1f2",
      "--goose-inline-code-fg": "#be123c",
      "--goose-inline-code-border-hover": "#fecdd3",
      "--goose-editor-selection-bg": "#ffe4e6",
    },
    dark: {
      "--goose-interactive-selected": "#462e37",
      "--goose-interactive-selected-fg": "#f1b2c5",
      "--goose-interactive-selected-border": "#d486a0",
      "--goose-sidebar-hover": "#382a30",
      "--goose-interactive-hover": "#382a30",
      "--goose-interactive-hover-fg": "#f1b2c5",
      "--goose-interactive-hover-border": "#d486a0",
      "--goose-inline-code-bg": "#66333b",
      "--goose-inline-code-fg": "#fecdd3",
      "--goose-inline-code-border-hover": "#f43f5e",
      "--goose-editor-selection-bg": "rgba(244, 63, 94, 0.35)",
    },
  },
  grape: {
    light: {
      "--goose-interactive-selected": "#f1e8f8",
      "--goose-interactive-selected-fg": "#6e2e9e",
      "--goose-interactive-selected-border": "#9d6abf",
      "--goose-sidebar-hover": "#f7f1fb",
      "--goose-interactive-hover": "#f7f1fb",
      "--goose-interactive-hover-fg": "#6e2e9e",
      "--goose-interactive-hover-border": "#9d6abf",
      "--goose-inline-code-bg": "#faf5ff",
      "--goose-inline-code-fg": "#7e22ce",
      "--goose-inline-code-border-hover": "#e9d5ff",
      "--goose-editor-selection-bg": "#f3e8ff",
    },
    dark: {
      "--goose-interactive-selected": "#3d2e4a",
      "--goose-interactive-selected-fg": "#d6b3ef",
      "--goose-interactive-selected-border": "#b088cc",
      "--goose-sidebar-hover": "#302837",
      "--goose-interactive-hover": "#302837",
      "--goose-interactive-hover-fg": "#d6b3ef",
      "--goose-interactive-hover-border": "#b088cc",
      "--goose-inline-code-bg": "#46305d",
      "--goose-inline-code-fg": "#e9d5ff",
      "--goose-inline-code-border-hover": "#a855f7",
      "--goose-editor-selection-bg": "rgba(168, 85, 247, 0.35)",
    },
  },
};

function isDarkDocument(root: Element): boolean {
  return root.classList.contains("dark");
}

export function resolveAccentRuntimeTokens(
  accentColor: AccentColor,
  isDark: boolean,
): Record<string, string> {
  const tokens =
    ACCENT_RUNTIME_TOKENS[accentColor] ?? ACCENT_RUNTIME_TOKENS[DEFAULT_ACCENT_COLOR];
  const theme = isDark ? tokens.dark : tokens.light;
  const selected = theme["--goose-interactive-selected"];
  return {
    ...theme,
    "--goose-icon-chip-on-selected": selected,
  };
}

const RUNTIME_STYLE_ID = "goose-accent-runtime-vars";

function ensureRuntimeStyleEl(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;
  if (typeof document.getElementById !== "function") return null;
  if (typeof document.createElement !== "function") return null;
  let el = document.getElementById(RUNTIME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = RUNTIME_STYLE_ID;
    // 尽量挂到 head 末尾，压过打包 CSS
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}

function writeAccentRuntimeTokens(
  root: HTMLElement,
  accentColor: AccentColor,
): void {
  if (!root?.style?.setProperty) return;
  const tokens = resolveAccentRuntimeTokens(accentColor, isDarkDocument(root));
  for (const [name, value] of Object.entries(tokens)) {
    // 旧内核 / 后续 CSS 偶发盖掉自定义属性时，important 保证行内代码跟强调色
    root.style.setProperty(name, value, "important");
  }

  // 再挂一份 style 标签：直接给编辑器 code 上色，彻底绕开变量被盖
  const styleEl = ensureRuntimeStyleEl();
  if (!styleEl) return;
  const bg = tokens["--goose-inline-code-bg"];
  const fg = tokens["--goose-inline-code-fg"];
  const border = tokens["--goose-inline-code-border-hover"];
  styleEl.textContent = `
:root {
  --goose-inline-code-bg: ${bg} !important;
  --goose-inline-code-fg: ${fg} !important;
  --goose-inline-code-border-hover: ${border} !important;
  --goose-interactive-selected: ${tokens["--goose-interactive-selected"]} !important;
  --goose-interactive-selected-fg: ${tokens["--goose-interactive-selected-fg"]} !important;
  --goose-interactive-selected-border: ${tokens["--goose-interactive-selected-border"]} !important;
  --goose-sidebar-hover: ${tokens["--goose-sidebar-hover"]} !important;
  --goose-interactive-hover: ${tokens["--goose-interactive-hover"]} !important;
  --goose-interactive-hover-fg: ${tokens["--goose-interactive-hover-fg"]} !important;
  --goose-interactive-hover-border: ${tokens["--goose-interactive-hover-border"]} !important;
  --goose-icon-chip-on-selected: ${tokens["--goose-icon-chip-on-selected"]} !important;
  --goose-editor-selection-bg: ${tokens["--goose-editor-selection-bg"]} !important;
}
.workspace-editor-surface .bn-inline-content code,
.quicknote-editor-surface .bn-inline-content code,
.ai-markdown code:not(pre > code),
.ai-md [data-streamdown="inline-code"] {
  background-color: ${bg} !important;
  color: ${fg} !important;
}
.workspace-editor-surface .bn-inline-content code [data-goose-inline-code-content],
.quicknote-editor-surface .bn-inline-content code [data-goose-inline-code-content] {
  color: ${fg} !important;
}
`.trim();
}

/**
 * 应用强调色：
 * 1. 写 data-goose-accent，供静态 CSS preset 覆盖 primary 等其余 token
 * 2. 直接 setProperty 关键表面 token，避免仅靠选择器时行内代码掉回 iris fallback
 */
export function applyAccentColor(accentColor: AccentColor): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-goose-accent", accentColor);
  writeAccentRuntimeTokens(root, accentColor);
}

/**
 * 按当前 data-goose-accent + 明暗 class 重刷 runtime token。
 * 主题切换后应调用，避免仍停在上一模式的 inline-code vars。
 */
export function syncAccentColorCssVars(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root || typeof root.getAttribute !== "function") return;
  const accentAttr = root.getAttribute("data-goose-accent");
  const accentColor = (accentAttr ?? DEFAULT_ACCENT_COLOR) as AccentColor;
  writeAccentRuntimeTokens(root, accentColor);
}
