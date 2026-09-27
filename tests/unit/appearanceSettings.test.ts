import { expect, test } from "playwright/test";
import {
  normalizeAccentColor,
  resolveCodeTheme,
} from "../../src/stores/settings/types";
import {
  APPEARANCE_INITIAL_STATE,
  createAppearanceSlice,
} from "../../src/stores/settings/slices/appearanceSlice";
import { resolveTheme } from "../../src/hooks/useResolvedTheme";
import {
  applyAccentColor,
  syncAccentColorCssVars,
} from "../../src/lib/accentColor";

test("强调色默认使用海洋配色，非法持久化值安全回退", () => {
  expect(APPEARANCE_INITIAL_STATE.accentColor).toBe("ocean");
  expect(APPEARANCE_INITIAL_STATE.randomIconOnCreate).toBe(false);
  expect(normalizeAccentColor(undefined)).toBe("ocean");
  expect(normalizeAccentColor("unknown")).toBe("ocean");
  expect(normalizeAccentColor("ocean")).toBe("ocean");
  expect(normalizeAccentColor("mono")).toBe("mono");
  expect(normalizeAccentColor("teal")).toBe("mono");
  expect(normalizeAccentColor("grape")).toBe("grape");
});

test("应用强调色写入 data-goose-accent 与关键 runtime token", () => {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  const classList = new Set<string>(["dark"]);
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      head: {
        appendChild: () => undefined,
      },
      getElementById: () => null,
      createElement: () => ({
        id: "",
        textContent: "",
      }),
      documentElement: {
        classList: {
          contains: (name: string) => classList.has(name),
        },
        setAttribute: (name: string, value: string) =>
          attributes.set(name, value),
        style: {
          setProperty: (name: string, value: string, _priority?: string) =>
            properties.set(name, value),
        },
      },
    },
  });

  try {
    applyAccentColor("amber");
    expect(attributes.get("data-goose-accent")).toBe("amber");
    expect(properties.get("--goose-inline-code-bg")).toBe("#4a3b24");
    expect(properties.get("--goose-inline-code-fg")).toBe("#fde68a");
    expect(properties.get("--goose-inline-code-border-hover")).toBe("#f59e0b");
    expect(properties.get("--goose-interactive-selected-fg")).toBe("#fbbf24");
  } finally {
    if (previousDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  }
});

test("应用强调色在浅色模式写入对应 light runtime token", () => {
  const properties = new Map<string, string>();
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      head: {
        appendChild: () => undefined,
      },
      getElementById: () => null,
      createElement: () => ({
        id: "",
        textContent: "",
      }),
      documentElement: {
        classList: {
          contains: () => false,
        },
        setAttribute: () => undefined,
        style: {
          setProperty: (name: string, value: string, _priority?: string) =>
            properties.set(name, value),
        },
      },
    },
  });

  try {
    applyAccentColor("amber");
    expect(properties.get("--goose-inline-code-bg")).toBe("#f5e8cb");
    expect(properties.get("--goose-inline-code-fg")).toBe("#93702c");
    expect(properties.get("--goose-interactive-hover")).toBe("#ebdfc6");
    expect(properties.get("--goose-icon-chip-on-selected")).toBe(
      properties.get("--goose-interactive-selected"),
    );
  } finally {
    if (previousDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  }
});

test("主题 class 变化后 re-sync 会按 dark/light 重写 inline-code token", () => {
  const properties = new Map<string, string>();
  const classList = new Set<string>();
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      head: {
        appendChild: () => undefined,
      },
      getElementById: () => null,
      createElement: () => ({
        id: "",
        textContent: "",
      }),
      documentElement: {
        classList: {
          contains: (name: string) => classList.has(name),
          add: (name: string) => {
            classList.add(name);
          },
          remove: (name: string) => {
            classList.delete(name);
          },
        },
        getAttribute: () => "amber",
        setAttribute: () => undefined,
        style: {
          setProperty: (name: string, value: string, _priority?: string) =>
            properties.set(name, value),
        },
      },
    },
  });

  try {
    applyAccentColor("amber");
    expect(properties.get("--goose-inline-code-bg")).toBe("#f5e8cb");
    expect(properties.get("--goose-inline-code-fg")).toBe("#93702c");

    classList.add("dark");
    syncAccentColorCssVars();
    expect(properties.get("--goose-inline-code-bg")).toBe("#4a3b24");
    expect(properties.get("--goose-inline-code-fg")).toBe("#fde68a");
  } finally {
    if (previousDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  }
});

test("代码主题固定为 GitHub 并随应用明暗切换", () => {
  expect(resolveCodeTheme(false)).toBe("github-light");
  expect(resolveCodeTheme(true)).toBe("github-dark");
  expect("codeStyle" in APPEARANCE_INITIAL_STATE).toBe(false);
});

test("跟随系统主题能解析系统明暗状态", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
});

test("侧栏字号与编辑器字号互相独立且各自夹紧边界", () => {
  expect(APPEARANCE_INITIAL_STATE.sidebarFontSize).toBe(13);
  expect(APPEARANCE_INITIAL_STATE.editorFontSize).toBe(17);

  let sidebarFontSize = 13;
  let editorFontSize = 16;
  const slice = createAppearanceSlice(
    (updater) => {
      const current = { sidebarFontSize, editorFontSize };
      const next =
        typeof updater === "function" ? updater(current as never) : updater;
      if (typeof next.sidebarFontSize === "number") {
        sidebarFontSize = next.sidebarFontSize;
      }
      if (typeof next.editorFontSize === "number") {
        editorFontSize = next.editorFontSize;
      }
    },
    () => ({
      applyTheme: () => undefined,
      applyAccentColor: () => undefined,
    }),
  );

  slice.increaseSidebarFontSize();
  slice.increaseSidebarFontSize();
  expect(sidebarFontSize).toBe(15);
  expect(editorFontSize).toBe(16);

  slice.setEditorFontSize(20);
  expect(sidebarFontSize).toBe(15);
  expect(editorFontSize).toBe(20);

  slice.setSidebarFontSize(99);
  slice.setEditorFontSize(4);
  expect(sidebarFontSize).toBe(18);
  expect(editorFontSize).toBe(12);
});

test("主题轮转顺序为 system → light → dark → system", () => {
  expect(APPEARANCE_INITIAL_STATE.theme).toBe("system");

  let theme: "system" | "light" | "dark" = "system";
  const applied: Array<"system" | "light" | "dark"> = [];
  const slice = createAppearanceSlice(
    (updater) => {
      const next =
        typeof updater === "function" ? updater({ theme } as never) : updater;
      if (next.theme) theme = next.theme;
    },
    () => ({
      applyTheme: (nextTheme) => {
        applied.push(nextTheme);
      },
      applyAccentColor: () => undefined,
    }),
  );

  slice.toggleDarkMode();
  expect(theme).toBe("light");
  slice.toggleDarkMode();
  expect(theme).toBe("dark");
  slice.toggleDarkMode();
  expect(theme).toBe("system");
  expect(applied).toEqual(["light", "dark", "system"]);
});
