import { useBlockNoteEditor, useEditorState } from "@blocknote/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/editor/ui/button";
import { Portal } from "@/components/editor/ui/portal";
import { cn } from "@/components/editor/utils/cn";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import { setFakeSelection } from "@/components/editor/extensions/fakeSelectionExtension";
import {
  restoreTextSelectionRange,
  withPreservedSelection,
} from "@/components/editor/toolbars/formatting/helpers";
import {
  applyHeadingBlockBackground,
  getHeadingBackgroundSelectionState,
  getToolbarTargetBlocks,
} from "@/components/editor/toolbars/formatting/headingBlockBackground";

interface PositionState {
  top: number;
  left: number;
  showAbove: boolean;
}

function colorPanelBoxStyle(position: PositionState): {
  top: number | "auto";
  bottom: number | "auto";
  left: number;
} {
  if (position.showAbove) {
    return {
      top: "auto",
      bottom: document.documentElement.clientHeight - position.top,
      left: position.left,
    };
  }
  return {
    top: position.top,
    bottom: "auto",
    left: position.left,
  };
}

const PANEL_BASE_WIDTH = 172;
const PANEL_BASE_HEIGHT = 190;
const PANEL_VIEWPORT_PADDING = 8;

export function getColorPanelPosition({
  trigger,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  gap,
  forceShowAbove,
}: {
  trigger: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width">;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap: number;
  forceShowAbove?: boolean;
}): PositionState {
  const padding = PANEL_VIEWPORT_PADDING;
  const spaceAbove = trigger.top - padding;
  const spaceBelow = viewportHeight - padding - trigger.bottom;
  const needed = panelHeight + gap;
  // 底栏 / 小窗场景：触发器靠近视口下半区时优先向上展开，
  // 避免色板开到窗口外只露出「文本颜色」标题，看起来像坏掉的 tooltip。
  const nearBottom = trigger.bottom > viewportHeight * 0.55;
  const showAbove =
    forceShowAbove ??
    (nearBottom
      ? spaceAbove >= Math.min(needed, spaceBelow + 1) || spaceAbove > spaceBelow
      : spaceAbove >= needed ||
        (spaceBelow < needed && spaceAbove > spaceBelow));
  const halfWidth = panelWidth / 2;
  const preferredLeft = trigger.left + trigger.width / 2;
  const minLeft = padding + halfWidth;
  const maxLeft = viewportWidth - padding - halfWidth;

  return {
    top: showAbove ? trigger.top - gap : trigger.bottom + gap,
    left:
      minLeft <= maxLeft
        ? Math.min(Math.max(preferredLeft, minLeft), maxLeft)
        : viewportWidth / 2,
    showAbove,
  };
}

function readEditorUiScale(): number {
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--editor-ui-scale",
    ),
  );
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function measureColorPanelPosition(
  button: HTMLElement,
  panel: HTMLElement | null,
  forceShowAbove?: boolean,
): PositionState {
  const scale = readEditorUiScale();
  return getColorPanelPosition({
    trigger: button.getBoundingClientRect(),
    panelWidth: panel?.offsetWidth ?? PANEL_BASE_WIDTH * scale,
    panelHeight: panel?.offsetHeight ?? PANEL_BASE_HEIGHT * scale,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    gap: 8 * scale,
    forceShowAbove,
  });
}

/** BlockNote 命名颜色 —— 必须与 BlockNote CSS 中定义的颜色名一致 */
const TEXT_COLORS = [
  { name: "默认", color: "default" },
  { name: "灰色", color: "gray" },
  { name: "褐色", color: "brown" },
  { name: "红色", color: "red" },
  { name: "橙色", color: "orange" },
  { name: "黄色", color: "yellow" },
  { name: "绿色", color: "green" },
  { name: "蓝色", color: "blue" },
  { name: "紫色", color: "purple" },
  { name: "粉色", color: "pink" },
];

const HIGHLIGHT_COLORS = [
  { name: "无背景", color: "default" },
  { name: "灰色背景", color: "gray" },
  { name: "褐色背景", color: "brown" },
  { name: "红色背景", color: "red" },
  { name: "橙色背景", color: "orange" },
  { name: "黄色背景", color: "yellow" },
  { name: "绿色背景", color: "green" },
  { name: "蓝色背景", color: "blue" },
  { name: "紫色背景", color: "purple" },
  { name: "粉色背景", color: "pink" },
];

/**
 * 颜色名 → CSS 颜色值。
 * 常规笔记本通过语义令牌与编辑区的明暗主题保持一致；速记小窗仍沿用原预览，
 * 避免跨越 quicknote.css 的独立样式边界。
 */
const previewColor = (token: string, fallback: string) =>
  typeof __GOOSE_LITE__ !== "undefined" && __GOOSE_LITE__
    ? fallback
    : `var(${token}, ${fallback})`;

const COLOR_PREVIEW: Record<string, string> = {
  gray: previewColor("--goose-editor-highlight-gray-text", "#9b9a97"),
  brown: previewColor("--goose-editor-highlight-brown-text", "#64473a"),
  red: previewColor("--goose-editor-highlight-red-text", "#e03e3e"),
  orange: previewColor("--goose-editor-highlight-orange-text", "#d9730d"),
  yellow: previewColor("--goose-editor-highlight-yellow-text", "#dfab01"),
  green: previewColor("--goose-editor-highlight-green-text", "#4d6461"),
  blue: previewColor("--goose-editor-highlight-blue-text", "#0b6e99"),
  purple: previewColor("--goose-editor-highlight-purple-text", "#6940a5"),
  pink: previewColor("--goose-editor-highlight-pink-text", "#ad1a72"),
};

const BG_PREVIEW: Record<string, string> = {
  gray: previewColor("--goose-editor-highlight-gray-bg", "#ebeced"),
  brown: previewColor("--goose-editor-highlight-brown-bg", "#e9e5e3"),
  red: previewColor("--goose-editor-highlight-red-bg", "#fbe4e4"),
  orange: previewColor("--goose-editor-highlight-orange-bg", "#f6e9d9"),
  yellow: previewColor("--goose-editor-highlight-yellow-bg", "#fbf3db"),
  green: previewColor("--goose-editor-highlight-green-bg", "#ddedea"),
  blue: previewColor("--goose-editor-highlight-blue-bg", "#ddebf1"),
  purple: previewColor("--goose-editor-highlight-purple-bg", "#eae4f2"),
  pink: previewColor("--goose-editor-highlight-pink-bg", "#f4dfeb"),
};

const MIXED = "__mixed__";

/**
 * 记忆策略：完整记住最近一次通过颜色面板「应用」的文本色 / 背景色。
 * - 点文本色：只更新 lastTextColor（含 default）
 * - 点背景色：只更新 lastBackgroundColor（含 default / 无背景）
 * - 右键色对：同时更新两者
 * - 点击 / 右键工具栏 Palette：当前不是上次颜色时复现记忆；再次操作清除颜色
 * - 两者都没有记录时 no-op
 * 使用 localStorage，跨笔记 / 重启可复用；读写对 SSR / 无 window 安全。
 */
const LAST_FORMAT_COLORS_KEY = "goose-note:last-format-colors";

const KNOWN_TEXT_COLORS = new Set(TEXT_COLORS.map((item) => item.color));
const KNOWN_BG_COLORS = new Set(HIGHLIGHT_COLORS.map((item) => item.color));

type LastFormatColors = {
  textColor?: string;
  backgroundColor?: string;
};

export function resolveHeldTextSelection(
  current: { empty: boolean; from: number; to: number },
  held: { from: number; to: number } | null,
): { from: number; to: number } | null {
  if (!current.empty && current.from !== current.to) {
    return {
      from: Math.min(current.from, current.to),
      to: Math.max(current.from, current.to),
    };
  }
  return held;
}

export function resolveHeldColorState<T>(
  live: T,
  held: T | null,
  hasLiveSelection: boolean,
): T {
  return hasLiveSelection || held == null ? live : held;
}

export function resolveOpenColorState<T>(
  live: T,
  held: T | null,
  isOpen: boolean,
): T {
  return isOpen && held != null ? held : live;
}

export function applyHeldColorPatch<T extends { textColor: string; backgroundColor: string }>(
  held: T,
  patch: Partial<Pick<T, "textColor" | "backgroundColor">>,
): T {
  return { ...held, ...patch };
}

export function isColorSwatchSelected(current: string, swatch: string): boolean {
  return current !== MIXED && current === swatch;
}

export function selectionUsesLastFormatColors(
  selection: { textColor: string; backgroundColor: string },
  last: LastFormatColors,
): boolean {
  const remembered = (["textColor", "backgroundColor"] as const).filter(
    (key) => last[key] !== undefined,
  );
  return (
    remembered.length > 0 &&
    remembered.every((key) => selection[key] === last[key])
  );
}

function isKnownColor(value: unknown, known: Set<string>): value is string {
  return typeof value === "string" && known.has(value);
}

function readLastFormatColors(): LastFormatColors {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_FORMAT_COLORS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<LastFormatColors>;
    const next: LastFormatColors = {};
    if (isKnownColor(parsed.textColor, KNOWN_TEXT_COLORS)) {
      next.textColor = parsed.textColor;
    }
    if (isKnownColor(parsed.backgroundColor, KNOWN_BG_COLORS)) {
      next.backgroundColor = parsed.backgroundColor;
    }
    return next;
  } catch {
    return {};
  }
}

function writeLastFormatColors(patch: LastFormatColors) {
  if (typeof window === "undefined") return;
  try {
    const current = readLastFormatColors();
    const next: LastFormatColors = { ...current };
    if (isKnownColor(patch.textColor, KNOWN_TEXT_COLORS)) {
      next.textColor = patch.textColor;
    }
    if (isKnownColor(patch.backgroundColor, KNOWN_BG_COLORS)) {
      next.backgroundColor = patch.backgroundColor;
    }
    // 仅在至少有一个有效字段时写入，避免清掉已有记忆
    if (next.textColor === undefined && next.backgroundColor === undefined) {
      return;
    }
    window.localStorage.setItem(LAST_FORMAT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // localStorage 不可用时静默失败，不影响颜色应用
  }
}

/**
 * Walks the current selection and returns the textColor / backgroundColor
 * marks across it. Returns `MIXED` if the selection spans more than one value.
 * BlockNote's useActiveStyles() only reads marks at selection.$to, so it
 * can't detect heterogeneous color selections — we scan the range ourselves.
 */
function useSelectionColorState(editor: BlockNoteEditor<any, any, any>) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;
      const headingBackground = getHeadingBackgroundSelectionState(
        getToolbarTargetBlocks(editor),
      );
      const textColors = new Set<string>();
      const bgColors = new Set<string>();
      const from = selection.from;
      const to = selection.to;

      if (from === to) {
        const marks = selection.$to.marks();
        const tc = marks.find((m: any) => m.type.name === "textColor");
        const bc = marks.find((m: any) => m.type.name === "backgroundColor");
        return {
          textColor: (tc?.attrs.stringValue as string | undefined) ?? "default",
          backgroundColor: headingBackground.isHeadingSelection
            ? headingBackground.backgroundColor
            : ((bc?.attrs.stringValue as string | undefined) ?? "default"),
        };
      }

      doc.nodesBetween(from, to, (node: any) => {
        if (!node.isText) return true;
        const tc = node.marks.find((m: any) => m.type.name === "textColor");
        const bc = node.marks.find(
          (m: any) => m.type.name === "backgroundColor",
        );
        textColors.add(
          (tc?.attrs.stringValue as string | undefined) ?? "default",
        );
        bgColors.add(
          (bc?.attrs.stringValue as string | undefined) ?? "default",
        );
        return false;
      });

      return {
        textColor:
          textColors.size === 0
            ? "default"
            : textColors.size === 1
              ? [...textColors][0]
              : MIXED,
        backgroundColor: headingBackground.isHeadingSelection
          ? headingBackground.backgroundColor
          : bgColors.size === 0
            ? "default"
            : bgColors.size === 1
              ? [...bgColors][0]
              : MIXED,
      };
    },
  });
}

export function FormattingToolbarColorPicker({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const editor = useBlockNoteEditor();
  const selectionColors = useSelectionColorState(editor);
  const [lastColors, setLastColors] = useState<LastFormatColors>(
    readLastFormatColors,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const openFrameRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sideLockRef = useRef<boolean | null>(null);
  const heldSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const selectionColorsRef = useRef(selectionColors);
  selectionColorsRef.current = selectionColors;
  const [heldColors, setHeldColors] = useState(selectionColors);

  const updatePanelPosition = useCallback((allowFlip = false) => {
    if (!buttonRef.current) return;
    const next = measureColorPanelPosition(
      buttonRef.current,
      panelRef.current,
      allowFlip ? undefined : (sideLockRef.current ?? undefined),
    );
    sideLockRef.current = next.showAbove;
    setPosition(next);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeAnimTimeoutRef.current)
        clearTimeout(closeAnimTimeoutRef.current);
      if (openFrameRef.current != null) {
        cancelAnimationFrame(openFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(isMounted);
  }, [isMounted, onOpenChange]);

  useEffect(() => {
    return () => onOpenChange?.(false);
  }, [onOpenChange]);

  const holdCurrentSelection = useCallback(() => {
    const { selection } = editor.prosemirrorState;
    const next = resolveHeldTextSelection(selection, heldSelectionRef.current);
    heldSelectionRef.current = next;
    if (next) setFakeSelection(editor, next);
    return next;
  }, [editor]);

  const applyWithHeldSelection = useCallback(
    (
      apply: () => void,
      patch?: Partial<Pick<typeof heldColors, "textColor" | "backgroundColor">>,
    ) => {
      restoreTextSelectionRange(editor, heldSelectionRef.current);
      withPreservedSelection(editor, apply);
      if (patch) {
        setHeldColors((prev) => applyHeldColorPatch(prev, patch));
      }
      holdCurrentSelection();
    },
    [editor, holdCurrentSelection],
  );

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
    if (!buttonRef.current) return;

    onOpenChange?.(true);
    if (!isMounted && !editor.prosemirrorState.selection.empty) {
      setHeldColors(selectionColorsRef.current);
    }
    holdCurrentSelection();

    if (isMounted) {
      setIsOpen(true);
      return;
    }

    const next = measureColorPanelPosition(buttonRef.current, panelRef.current);
    sideLockRef.current = next.showAbove;
    setPosition(next);
    setIsMounted(true);
    if (openFrameRef.current != null) cancelAnimationFrame(openFrameRef.current);
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = requestAnimationFrame(() => {
        setIsOpen(true);
        openFrameRef.current = null;
      });
    });
  };

  useLayoutEffect(() => {
    if (!isMounted || !buttonRef.current) return;
    updatePanelPosition(false);
  }, [isMounted, updatePanelPosition]);

  useEffect(() => {
    if (!isMounted) return;
    const update = () => updatePanelPosition(true);
    window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
      window.removeEventListener("resize", update);
    };
  }, [isMounted, updatePanelPosition]);

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      return;
    }
    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
    closeAnimTimeoutRef.current = setTimeout(() => {
      sideLockRef.current = null;
      heldSelectionRef.current = null;
      setFakeSelection(editor, null);
      setIsMounted(false);
      setPosition(null);
    }, 180);
  }, [editor, isOpen]);

  useEffect(() => {
    if (!isMounted) return;
    holdCurrentSelection();
  }, [editor, holdCurrentSelection, isMounted]);

  const displayColors = resolveOpenColorState(
    selectionColors,
    heldColors,
    isMounted,
  );
  const currentTextColor = displayColors.textColor;
  const currentBgColor = displayColors.backgroundColor;
  const isTextMixed = currentTextColor === MIXED;
  const isBgMixed = currentBgColor === MIXED;

  const isTextColorActive =
    !isTextMixed && currentTextColor && currentTextColor !== "default";
  const isBgColorActive =
    !isBgMixed && currentBgColor && currentBgColor !== "default";

  const applyTextColor = (color: string) => {
    applyWithHeldSelection(() => {
      if (color === "default") {
        editor.removeStyles({ textColor: true } as any);
      } else {
        editor.addStyles({ textColor: color });
      }
      rememberLastFormatColors({ textColor: color });
    }, { textColor: color });
  };

  const applyBackgroundColor = (color: string) => {
    applyWithHeldSelection(() => {
      if (applyHeadingBlockBackground(editor, color)) {
        rememberLastFormatColors({ backgroundColor: color });
        return;
      }
      if (color === "default") {
        editor.removeStyles({ backgroundColor: true } as any);
      } else {
        editor.addStyles({ backgroundColor: color });
      }
      rememberLastFormatColors({ backgroundColor: color });
    }, { backgroundColor: color });
  };

  const applyColorPair = (index: number) => {
    const textColor = TEXT_COLORS[index]?.color;
    const backgroundColor = HIGHLIGHT_COLORS[index]?.color;
    if (!textColor || !backgroundColor) return;
    applyWithHeldSelection(() => {
      // 先应用样式再一次写入，避免两次 localStorage 读写
      if (textColor === "default") {
        editor.removeStyles({ textColor: true } as any);
      } else {
        editor.addStyles({ textColor: textColor });
      }
      if (applyHeadingBlockBackground(editor, backgroundColor)) {
        // 标题背景已按完整块应用。
      } else if (backgroundColor === "default") {
        editor.removeStyles({ backgroundColor: true } as any);
      } else {
        editor.addStyles({ backgroundColor: backgroundColor });
      }
      rememberLastFormatColors({ textColor, backgroundColor });
    }, { textColor, backgroundColor });
  };

  const rememberLastFormatColors = (patch: LastFormatColors) => {
    writeLastFormatColors(patch);
    setLastColors(readLastFormatColors());
  };

  const lastTextPreview =
    lastColors.textColor && lastColors.textColor !== "default"
      ? COLOR_PREVIEW[lastColors.textColor]
      : undefined;
  const lastBgPreview =
    lastColors.backgroundColor && lastColors.backgroundColor !== "default"
      ? BG_PREVIEW[lastColors.backgroundColor]
      : undefined;
  const lastColorBar = lastBgPreview ?? lastTextPreview;

  const applyLastFormatColors = () => {
    const last = readLastFormatColors();
    if (last.textColor === undefined && last.backgroundColor === undefined) {
      return;
    }
    const clearing = selectionUsesLastFormatColors(displayColors, last);
    applyWithHeldSelection(() => {
      if (clearing) {
        editor.removeStyles({ textColor: true } as any);
        if (!applyHeadingBlockBackground(editor, "default")) {
          editor.removeStyles({ backgroundColor: true } as any);
        }
        return;
      }
      if (last.textColor !== undefined) {
        // 直接应用，不经 applyTextColor，避免把「未记忆的那一侧」误写成当前值
        if (last.textColor === "default") {
          editor.removeStyles({ textColor: true } as any);
        } else {
          editor.addStyles({ textColor: last.textColor });
        }
      }
      if (last.backgroundColor !== undefined) {
        if (applyHeadingBlockBackground(editor, last.backgroundColor)) {
          // 标题背景已按完整块应用。
        } else if (last.backgroundColor === "default") {
          editor.removeStyles({ backgroundColor: true } as any);
        } else {
          editor.addStyles({ backgroundColor: last.backgroundColor });
        }
      }
    }, clearing
      ? {
          textColor: last.textColor !== undefined ? "default" : displayColors.textColor,
          backgroundColor:
            last.backgroundColor !== undefined
              ? "default"
              : displayColors.backgroundColor,
        }
      : {
          ...(last.textColor !== undefined ? { textColor: last.textColor } : {}),
          ...(last.backgroundColor !== undefined
            ? { backgroundColor: last.backgroundColor }
            : {}),
        });
  };

  const panelContent = isMounted && position ? (
    <div
      ref={panelRef}
      className="goose-color-picker-float"
      data-open={isOpen ? "true" : "false"}
      data-side={position.showAbove ? "above" : "below"}
      onMouseDown={(e) => e.preventDefault()}
      style={colorPanelBoxStyle(position)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="goose-color-picker-panel flex flex-col border border-border bg-popover shadow-md"
      >
        <div className="goose-color-picker-title font-semibold text-muted-foreground">
          文本颜色
        </div>
        <div className="goose-color-picker-grid grid">
          {TEXT_COLORS.map((item, index) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "goose-color-picker-swatch h-7 w-7 min-h-7 min-w-7 shrink-0 border border-transparent p-0 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                isColorSwatchSelected(currentTextColor, item.color)
                  ? "bg-accent border-primary/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]"
                  : "",
              )}
              onClick={() => {
                applyTextColor(item.color);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColorPair(index);
              }}
            >
              <div
                className="goose-color-picker-letter font-serif leading-none"
                style={{
                  color:
                    item.color === "default"
                      ? undefined
                      : COLOR_PREVIEW[item.color],
                }}
              >
                A
              </div>
            </Button>
          ))}
        </div>

        <div className="goose-color-picker-divider border-t border-border/60" />

        <div className="goose-color-picker-title font-semibold text-muted-foreground">
          背景颜色
        </div>
        <div className="goose-color-picker-grid goose-color-picker-grid-last grid">
          {HIGHLIGHT_COLORS.map((item, index) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "goose-color-picker-swatch h-7 w-7 min-h-7 min-w-7 shrink-0 border border-transparent p-0 hover:border-border/80 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                isColorSwatchSelected(currentBgColor, item.color)
                  ? "border-primary ring-1 ring-primary/25"
                  : "",
              )}
              onClick={() => {
                applyBackgroundColor(item.color);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColorPair(index);
              }}
            >
              <div
                className="goose-color-picker-background-swatch border border-border/20"
                style={{
                  backgroundColor:
                    item.color === "default"
                      ? "transparent"
                      : BG_PREVIEW[item.color],
                }}
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        ref={buttonRef}
        data-goose-preserve-icon-color="true"
        aria-pressed={
          isMounted ||
          isTextColorActive ||
          isBgColorActive ||
          isTextMixed ||
          isBgMixed
        }
        className={cn("goose-formatting-toolbar-control")}
        aria-label="颜色选择；点击应用上次颜色"
        onClick={() => {
          applyLastFormatColors();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          applyLastFormatColors();
        }}
      >
        <span className="relative inline-flex size-4 items-center justify-center">
          <LucideIcons.Palette
            aria-hidden="true"
            className="size-4"
            style={lastTextPreview ? { color: lastTextPreview } : undefined}
          />
          {lastColorBar ? (
            <span
              className="absolute inset-x-0.5 bottom-0 h-0.5 rounded-full"
              style={{ background: lastColorBar }}
            />
          ) : null}
        </span>
      </button>
      <Portal>{panelContent}</Portal>
    </div>
  );
}
