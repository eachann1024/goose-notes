import { useEffect, useRef, useState, useCallback } from "react";
import { Trash2, ChevronRight, StretchHorizontal, PanelTop, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_BG_COLORS } from "@/lib/blockColorPresets";
import type { Editor } from "@tiptap/core";

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface DragHandleClickDetail {
  nodePos: number | null;
  nodeType: string | null;
  anchorRect: AnchorRect;
}

interface DragHandleBlockMenuProps {
  editor: Editor | null;
}

interface BlockColorAttrs {
  blockTextColor: string | null;
  blockBgColor: string | null;
}

interface OpenPanels {
  text: boolean;
  bg: boolean;
}

// ---- 颜色预设 ----
const TEXT_COLORS = [
  { label: "默认", value: null, css: "rgba(55,53,47,0.85)", darkCss: "rgba(255,255,255,0.81)" },
  { label: "灰色", value: "gray", css: "#787774" },
  { label: "棕色", value: "brown", css: "#9F6B53" },
  { label: "橙色", value: "orange", css: "#D9730D" },
  { label: "黄色", value: "yellow", css: "#CB912F" },
  { label: "绿色", value: "green", css: "#448361" },
  { label: "蓝色", value: "blue", css: "#337EA9" },
  { label: "紫色", value: "purple", css: "#9065B0" },
  { label: "粉红", value: "pink", css: "#C14C8A" },
  { label: "红色", value: "red", css: "#D44C47" },
];

function formatEditTime(ts: number | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const timeStr = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return `今天 ${timeStr}`;
  const dateStr = d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  return `${dateStr} ${timeStr}`;
}

// ---- 色块按钮 ----
function ColorDot({
  css,
  border,
  active,
  onClick,
  label,
}: {
  css: string;
  border?: boolean;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "w-[18px] h-[18px] rounded-sm transition-all hover:scale-110 flex items-center justify-center",
        border && "border border-border/60",
        active && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ backgroundColor: css }}
    >
      {css === "transparent" && (
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-30">
          <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}

// ---- 主组件 ----
const MENU_WIDTH = 180;

export function DragHandleBlockMenu({ editor }: DragHandleBlockMenuProps) {
  const [open, setOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<OpenPanels>({
    text: false,
    bg: false,
  });
  const [detail, setDetail] = useState<DragHandleClickDetail | null>(null);
  const [liveAttrs, setLiveAttrs] = useState<BlockColorAttrs>({
    blockTextColor: null,
    blockBgColor: null,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // 页面编辑时间
  const { activePageId, getPage } = usePages();
  const page = activePageId ? getPage(activePageId) : undefined;
  const editTimeStr = formatEditTime(page?.updatedAt);

  const handleDragHandleClick = useCallback((e: Event) => {
    const ev = e as CustomEvent<DragHandleClickDetail>;
    setDetail(ev.detail);
    setOpen(true);
    setOpenPanels({ text: false, bg: false });
  }, []);

  useEffect(() => {
    document.addEventListener("drag-handle-click", handleDragHandleClick);
    return () => document.removeEventListener("drag-handle-click", handleDragHandleClick);
  }, [handleDragHandleClick]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onPD = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setOpenPanels({ text: false, bg: false });
      }
    };
    document.addEventListener("pointerdown", onPD, { capture: true });
    return () => document.removeEventListener("pointerdown", onPD, { capture: true });
  }, [open]);

  // 同步 handle 激活状态
  useEffect(() => {
    const handleEl = document.querySelector(".drag-handle");
    if (open) {
      handleEl?.classList.add("active");
    } else {
      handleEl?.classList.remove("active");
    }
    return () => handleEl?.classList.remove("active");
  }, [open]);

  const close = () => {
    setOpen(false);
    setOpenPanels({ text: false, bg: false });
  };

  const togglePanel = (panel: keyof OpenPanels) => {
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  // ---- 当前块属性 ----
  const readCurrentAttrs = useCallback((): BlockColorAttrs => {
    if (!editor || detail?.nodePos == null) {
      return {
        blockTextColor: null,
        blockBgColor: null,
      };
    }
    try {
      const attrs = editor.state.doc.nodeAt(detail.nodePos)?.attrs ?? null;
      return {
        blockTextColor: attrs?.blockTextColor ?? null,
        blockBgColor: attrs?.blockBgColor ?? null,
      };
    } catch {
      return {
        blockTextColor: null,
        blockBgColor: null,
      };
    }
  }, [detail?.nodePos, editor]);

  useEffect(() => {
    setLiveAttrs(readCurrentAttrs());
  }, [open, readCurrentAttrs]);

  useEffect(() => {
    if (!editor || !open) return;
    const syncAttrs = () => setLiveAttrs(readCurrentAttrs());
    editor.on("transaction", syncAttrs);
    return () => {
      editor.off("transaction", syncAttrs);
    };
  }, [editor, open, readCurrentAttrs]);

  const setBlockAttr = (key: keyof BlockColorAttrs, value: string | null) => {
    if (!editor || detail?.nodePos == null) return;
    const pos = detail.nodePos;
    editor.chain().focus().command(({ tr, state, dispatch }) => {
      const node = state.doc.nodeAt(pos);
      if (!node) return false;
      if (dispatch) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, [key]: value });
        if (key === "blockTextColor" || key === "blockBgColor") {
          state.doc.nodesBetween(pos, pos + node.nodeSize, (child, childPos) => {
            if (child.isText && child.marks.length > 0) {
              if (key === "blockTextColor") {
                const textStyleMark = child.marks.find((m) => m.type.name === "textStyle");
                if (textStyleMark && textStyleMark.attrs.color) {
                  tr.removeMark(childPos, childPos + child.nodeSize, textStyleMark);
                }
              }
              if (key === "blockBgColor") {
                const highlightMark = child.marks.find((m) => m.type.name === "highlight");
                if (highlightMark) {
                  tr.removeMark(childPos, childPos + child.nodeSize, highlightMark);
                }
              }
            }
          });
          if (key === "blockTextColor" && state.schema.marks.textStyle) {
            tr.removeStoredMark(state.schema.marks.textStyle);
          }
          if (key === "blockBgColor" && state.schema.marks.highlight) {
            tr.removeStoredMark(state.schema.marks.highlight);
          }
        }
      }
      return true;
    }).run();
    setLiveAttrs((prev) => ({ ...prev, [key]: value }));
  };

  // ---- 删除 ----
  const handleDelete = () => {
    if (!editor || detail?.nodePos == null) return;
    const pos = detail.nodePos;
    editor.chain().focus().command(({ tr, state, dispatch }) => {
      const node = state.doc.nodeAt(pos);
      if (!node) return false;
      if (dispatch) {
        let newTr = tr.delete(pos, pos + node.nodeSize);
        if (newTr.doc.childCount === 0) {
          const p = state.schema.nodes.paragraph?.create();
          if (p) newTr = newTr.insert(0, p);
        }
        dispatch(newTr.scrollIntoView());
      }
      return true;
    }).run();
    close();
  };

  if (!open || !detail) return null;

  const { anchorRect } = detail;

  // 始终在把手左侧弹出，允许叠在侧边栏上方。当极窄时最多贴着最左边（保留 8px 安全边距）
  const menuLeft = Math.max(8, anchorRect.left - MENU_WIDTH - 8);

  // 防止超出屏幕底部
  const maxBottom = window.innerHeight - 12;
  const expandedPanelCount = Number(openPanels.text) + Number(openPanels.bg);
  const estimatedHeight = 140 + expandedPanelCount * 120;
  let menuTop = anchorRect.top;
  if (menuTop + estimatedHeight > maxBottom) {
    menuTop = Math.max(8, maxBottom - estimatedHeight);
  }

  const curTextColor = liveAttrs.blockTextColor;
  const curBgColor = liveAttrs.blockBgColor;

  // ---- 颜色预览条 ----
  const textColorEntry = TEXT_COLORS.find((c) => c.value === curTextColor) ?? TEXT_COLORS[0];
  const bgColorEntry =
    BLOCK_BG_COLORS.find((c) => c.value === curBgColor) ?? BLOCK_BG_COLORS[0];

  const isTable = detail?.nodeType === "table";

  const handleClickTableCommand = (commandName: "toggleHeaderRow" | "toggleHeaderColumn" | "fitWidth") => {
    if (!editor || detail?.nodePos == null) return;
    const pos = detail.nodePos;
    
    if (commandName === "fitWidth") {
        editor.chain().focus().command(({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== "table") return false;
          if (dispatch) {
            node.descendants((child, childPos) => {
              if (child.type.name === "tableCell" || child.type.name === "tableHeader") {
                tr.setNodeMarkup(pos + 1 + childPos, null, { ...child.attrs, colwidth: null });
              }
            });
          }
          return true;
        }).run();
        close();
        return;
    }

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    let targetPos = pos + 2; 
    editor.state.doc.nodesBetween(pos, pos + node.nodeSize, (n, p) => {
        if (n.isTextblock && targetPos === pos + 2) {
            targetPos = p + 1;
        }
    });

    if (commandName === "toggleHeaderRow") {
        editor.chain().focus().setTextSelection(targetPos).toggleHeaderRow().run();
    } else {
        editor.chain().focus().setTextSelection(targetPos).toggleHeaderColumn().run();
    }
    close();
  };

  let hasHeaderRow = false;
  let hasHeaderColumn = false;
  if (isTable && editor && detail?.nodePos != null) {
      const node = editor.state.doc.nodeAt(detail.nodePos);
      if (node && node.type.name === 'table' && node.childCount > 0) {
          const firstRow = node.firstChild;
          if (firstRow && firstRow.childCount > 0) {
              hasHeaderRow = firstRow.firstChild?.type.name === 'tableHeader';
          }
          let allFirstAreHeader = true;
          node.forEach((row) => {
              if (row.firstChild && row.firstChild.type.name !== 'tableHeader') {
                  allFirstAreHeader = false;
              }
          });
          hasHeaderColumn = allFirstAreHeader;
      }
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuTop,
        left: menuLeft,
        width: MENU_WIDTH,
        zIndex: 100000,
      }}
      className="animate-in fade-in zoom-in-95 slide-in-from-left-1 duration-100"
    >
      <div className="rounded-[10px] border border-border/40 bg-[hsl(var(--popover)/0.99)] text-popover-foreground shadow-[0_8px_30px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.08)] overflow-hidden">

        {!isTable && (
          <>
            {/* 颜色 - 字体颜色 */}
            <button
              type="button"
              onClick={() => togglePanel("text")}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--goose-interactive-selected)] transition-colors"
            >
              {/* 字体颜色预览 */}
              <span
                className="flex h-4 w-4 items-center justify-center rounded-sm text-[11px] font-bold border border-border/50 shrink-0"
                style={{
                  color: textColorEntry.css,
                  borderColor: curTextColor ? `${textColorEntry.css}55` : undefined,
                }}
              >
                A
              </span>
              <span className="flex-1 text-left text-foreground/90">字体颜色</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150",
                  openPanels.text && "rotate-90"
                )}
              />
            </button>

            {/* 字体颜色面板 */}
            {openPanels.text && (
              <div className="px-3 pb-2.5 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <ColorDot
                      key={c.value ?? "default"}
                      css={c.css}
                      border={!c.value}
                      active={curTextColor === c.value}
                      label={c.label}
                      onClick={() => {
                        setBlockAttr("blockTextColor", c.value);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 颜色 - 背景颜色 */}
            <button
              type="button"
              onClick={() => togglePanel("bg")}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--goose-interactive-selected)] transition-colors"
            >
              {/* 背景颜色预览 */}
              <span
                className="flex h-4 w-4 items-center justify-center rounded-sm text-[11px] font-bold border border-border/50 shrink-0"
                style={{
                  backgroundColor: curBgColor ? bgColorEntry.css : undefined,
                  color: curBgColor ? "#555" : "var(--muted-foreground)",
                }}
              >
                A
              </span>
              <span className="flex-1 text-left text-foreground/90">背景颜色</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150",
                  openPanels.bg && "rotate-90"
                )}
              />
            </button>

            {/* 背景颜色面板 */}
            {openPanels.bg && (
              <div className="px-3 pb-2.5 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {BLOCK_BG_COLORS.map((c) => (
                    <ColorDot
                      key={c.value ?? "default"}
                      css={c.css}
                      border={!c.value}
                      active={curBgColor === c.value}
                      label={c.label}
                      onClick={() => {
                        setBlockAttr("blockBgColor", c.value);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isTable && (
          <>
            <button
              type="button"
              onClick={() => handleClickTableCommand("fitWidth")}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--goose-interactive-selected)] transition-colors"
            >
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                <StretchHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-left text-foreground/90">适应宽度</span>
            </button>
            <button
              type="button"
              onClick={() => handleClickTableCommand("toggleHeaderRow")}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--goose-interactive-selected)] transition-colors"
            >
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                <PanelTop className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-left text-foreground/90">{hasHeaderRow ? "取消标题行" : "设为标题行"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleClickTableCommand("toggleHeaderColumn")}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--goose-interactive-selected)] transition-colors"
            >
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-left text-foreground/90">{hasHeaderColumn ? "取消标题列" : "设为标题列"}</span>
            </button>
          </>
        )}

        {/* 删除区块 */}
        <button
          type="button"
          onClick={handleDelete}
          className="group flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-[14px] w-[14px] shrink-0 text-muted-foreground group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
          <span className="flex-1 text-left">删除</span>
        </button>

        {/* 编辑时间 */}
        {editTimeStr && (
          <>
            <div className="px-3 py-2 text-[11px] text-muted-foreground/60 leading-snug select-none">
              上次编辑于 {editTimeStr}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
