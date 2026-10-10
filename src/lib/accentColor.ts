import { DEFAULT_ACCENT_COLOR, type AccentColor } from "@/stores/settings/types";

type AccentRuntimeTokens = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

// 深色交互表面与 CSS 的中性灰角色同步，强调色仅控制其余强调元素。
const NEUTRAL_DARK_RUNTIME_TOKENS: Record<string, string> = {
  "--goose-interactive-selected": "var(--goose-dark-selected-bg, #343434)",
  "--goose-interactive-selected-fg": "var(--goose-text-primary)",
  "--goose-interactive-selected-border": "var(--goose-dark-interactive-border, #4a4a4a)",
  "--goose-sidebar-hover": "var(--goose-dark-hover-bg, #2c2c2c)",
  "--goose-interactive-hover": "var(--goose-dark-hover-bg, #2c2c2c)",
  "--goose-interactive-hover-fg": "var(--goose-text-primary)",
  "--goose-interactive-hover-border": "var(--goose-dark-interactive-border, #4a4a4a)",
  "--goose-inline-code-bg": "var(--goose-dark-inline-code-bg, #333333)",
  "--goose-inline-code-fg": "var(--goose-text-primary)",
  "--goose-inline-code-border-hover": "var(--goose-dark-interactive-border, #4a4a4a)",
  "--goose-editor-selection-bg": "var(--goose-dark-selection-bg, #444444)",
};

/**
 * 运行时直接写入的交互 token。
 * 浅色表面跟随强调色，深色表面共用中性灰；直接写入可避免
 * 旧内核 / 缓存 CSS 只命中部分变量。文字消费全局可读性色表。
 */
const ACCENT_RUNTIME_TOKENS: Record<AccentColor, AccentRuntimeTokens> = {
  iris: {
    light: {
      "--goose-interactive-selected": "#eceafa",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#8174cb",
      "--goose-sidebar-hover": "#f3f1fb",
      "--goose-interactive-hover": "#f3f1fb",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#8174cb",
      "--goose-inline-code-bg": "#eef2ff",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#c7d2fe",
      "--goose-editor-selection-bg": "#e0e7ff",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  ocean: {
    light: {
      "--goose-interactive-selected": "#e5edfc",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#547dd0",
      "--goose-sidebar-hover": "#eef3fc",
      "--goose-interactive-hover": "#eef3fc",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#547dd0",
      "--goose-inline-code-bg": "#eff6ff",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#bfdbfe",
      "--goose-editor-selection-bg": "#dbeafe",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  mono: {
    light: {
      "--goose-interactive-selected": "#fcfcf7",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#756b42",
      "--goose-sidebar-hover": "#e3e1d5",
      "--goose-interactive-hover": "#e3e1d5",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#756b42",
      "--goose-inline-code-bg": "#eeebde",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#756b42",
      "--goose-editor-selection-bg": "#eeebde",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  pine: {
    light: {
      "--goose-interactive-selected": "#e4f1e8",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#559369",
      "--goose-sidebar-hover": "#edf5ef",
      "--goose-interactive-hover": "#edf5ef",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#559369",
      "--goose-inline-code-bg": "#f0fdf4",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#bbf7d0",
      "--goose-editor-selection-bg": "#dcfce7",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  amber: {
    light: {
      "--goose-interactive-selected": "#fffdf7",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#c9b894",
      "--goose-sidebar-hover": "#e9dfc7",
      "--goose-interactive-hover": "#e9dfc7",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#c9b894",
      "--goose-inline-code-bg": "#efe6cf",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#c9b894",
      "--goose-editor-selection-bg": "#e9dfc7",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  wheat: {
    light: {
      "--goose-interactive-selected": "#fcfbf3",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#aeb18e",
      "--goose-sidebar-hover": "#e0ddc8",
      "--goose-interactive-hover": "#e0ddc8",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#aeb18e",
      "--goose-inline-code-bg": "#e9e7d4",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#aeb18e",
      "--goose-editor-selection-bg": "#e0ddc8",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  coral: {
    light: {
      "--goose-interactive-selected": "#fbeadf",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#b76e4a",
      "--goose-sidebar-hover": "#fcf2ec",
      "--goose-interactive-hover": "#fcf2ec",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#b76e4a",
      "--goose-inline-code-bg": "#fff7ed",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#fed7aa",
      "--goose-editor-selection-bg": "#ffedd5",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  rose: {
    light: {
      "--goose-interactive-selected": "#f8e7eb",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#c36a83",
      "--goose-sidebar-hover": "#fbf0f2",
      "--goose-interactive-hover": "#fbf0f2",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#c36a83",
      "--goose-inline-code-bg": "#fff1f2",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#fecdd3",
      "--goose-editor-selection-bg": "#ffe4e6",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
  },
  grape: {
    light: {
      "--goose-interactive-selected": "#f1e8f8",
      "--goose-interactive-selected-fg": "var(--goose-text-primary)",
      "--goose-interactive-selected-border": "#9d6abf",
      "--goose-sidebar-hover": "#f7f1fb",
      "--goose-interactive-hover": "#f7f1fb",
      "--goose-interactive-hover-fg": "var(--goose-text-primary)",
      "--goose-interactive-hover-border": "#9d6abf",
      "--goose-inline-code-bg": "#faf5ff",
      "--goose-inline-code-fg": "var(--goose-text-info)",
      "--goose-inline-code-border-hover": "#e9d5ff",
      "--goose-editor-selection-bg": "#f3e8ff",
    },
    dark: NEUTRAL_DARK_RUNTIME_TOKENS,
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
    // 旧内核 / 后续 CSS 偶发盖掉自定义属性时，important 保证交互表面一致
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
