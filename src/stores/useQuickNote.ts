import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  uToolsStorage,
  readDbStorageJSON,
  writeDbStorageJSON,
} from "@/lib/storage";
import { usePages } from "@/stores/usePages";
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";
import {
  createEmptyLocalPageContent,
} from "@/components/editor/utils/blocknote-content";
import type { JSONContent, Page } from "@/types";

/**
 * 速记小窗状态（独立窗口进程内使用）。
 *
 * 小窗与主窗是两个独立的 WebView 进程，但共享同一份 uTools db。小窗是「草稿便签」：
 * 不直接对应一条真实笔记，编辑内容只落到草稿存储（draftContent，持久化），不写进 pages、
 * 不进笔记列表 / 搜索。用户点左上角「保存到笔记本」才把草稿整体 createPageRecord 入库，
 * 随后清空草稿、回到空白便签。
 *
 * 持久化：draftContent（草稿内容）、pinned（置顶偏好）、windowWidth/windowHeight（窗口尺寸记忆）。
 * 当前正在编辑的 draftPage 是会话态（每个进程基于 draftContent 现造），不持久化。
 */
interface QuickNoteState {
  /** 草稿内容（持久化，关窗重开仍在；保存入库后清空回空白） */
  draftContent: JSONContent | null;
  /**
   * 是否置顶钉住。速记小窗强制置顶（产品决定，无取消入口），恒为 true。
   * 字段保留仅为持久化结构兼容；不再有切换 UI。
   */
  pinned: boolean;
  /** 记住的窗口宽度（持久化，下次开窗沿用；手动拖动后更新） */
  windowWidth: number;
  /** 记住的窗口高度（持久化，下次开窗沿用；手动拖动后更新） */
  windowHeight: number;
  /**
   * 记住的窗口左上角 x/y（持久化，下次开窗沿用）。由主窗 preload 在拖动/关窗时
   * 用 win.getBounds() 权威写入 dbStorage；web store 仅透传保留，不主动设值——
   * 否则 store 每次 persist（partialize）会把 preload 写的位置抹掉。
   */
  windowX?: number;
  windowY?: number;
  /** 草稿内容变更（编辑器 onContentChange 调用，写入草稿存储） */
  setDraftContent: (content: JSONContent) => void;
  /**
   * 保存当前草稿到笔记本：以草稿内容新建一条真实笔记并落库，随后清空草稿。
   * 返回新笔记 id；草稿为空时返回 null（不产生空笔记）。
   */
  saveDraftToNotebook: () => string | null;
  /** 清空草稿，回到空白便签。 */
  clearDraft: () => void;
  setWindowWidth: (width: number) => void;
  setWindowHeight: (height: number) => void;
  setWindowSize: (width: number, height: number) => void;
}

/** 速记小窗默认宽度，与 preload QUICKNOTE_WIDTH 保持一致。 */
export const QUICKNOTE_DEFAULT_WIDTH = 480;
/** 速记小窗最小宽度，与 preload minWidth 保持一致。 */
export const QUICKNOTE_MIN_WIDTH = 320;
/** 速记小窗默认高度，与 preload QUICKNOTE_HEIGHT 保持一致。 */
export const QUICKNOTE_DEFAULT_HEIGHT = 350;
/** 速记小窗最小高度，与 preload QUICKNOTE_MIN_HEIGHT 保持一致。 */
export const QUICKNOTE_MIN_HEIGHT = 300;

/** 判断草稿内容是否为空白（无任何可见文本）——避免保存出空笔记。 */
const isDraftEmpty = (content: JSONContent | null): boolean => {
  if (!content) return true;
  const text = JSON.stringify(content)
    .replace(/"type"|"text"|"content"|"styles"|"props"|"id"|"children"/g, "");
  // 粗判：内容里若不含任何中日韩 / 拉丁 / 数字字符，视为空白。
  return !/[\p{L}\p{N}]/u.test(text);
};

export const useQuickNote = create<QuickNoteState>()(
  persist(
    (set, get) => ({
      draftContent: createEmptyLocalPageContent(),
      pinned: true, // 强制置顶，恒 true
      windowWidth: QUICKNOTE_DEFAULT_WIDTH,
      windowHeight: QUICKNOTE_DEFAULT_HEIGHT,
      windowX: undefined,
      windowY: undefined,

      setDraftContent: (content) => set({ draftContent: content }),

      saveDraftToNotebook: () => {
        const content = get().draftContent;
        if (isDraftEmpty(content)) {
          get().clearDraft();
          return null;
        }
        const nbId =
          useNotebooks.getState().activeNotebookId ?? DEFAULT_NOTEBOOK;
        const id = usePages.getState().createPageRecord({
          workspaceId: nbId,
          content: content ?? undefined,
        });
        get().clearDraft();
        return id;
      },

      clearDraft: () => set({ draftContent: null }),

      setWindowWidth: (width) =>
        set({ windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)) }),
      setWindowHeight: (height) =>
        set({ windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)) }),
      setWindowSize: (width, height) =>
        set({
          windowWidth: Math.max(QUICKNOTE_MIN_WIDTH, Math.round(width)),
          windowHeight: Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(height)),
        }),
    }),
    {
      name: "goose-note:quicknote",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        draftContent: state.draftContent,
        pinned: true, // 强制置顶，写回恒 true
        windowWidth: state.windowWidth,
        windowHeight: state.windowHeight,
        // 位置由 preload 权威写入 dbStorage；这里透传 hydrate 进来的值，
        // 避免 store persist 把 preload 写的 windowX/windowY 覆盖丢失。
        windowX: state.windowX,
        windowY: state.windowY,
      }),
      skipHydration: true,
    },
  ),
);

/**
 * 草稿是否为「空白单块」：null / 空数组 / 仅含一个无可见文本的块（如空段落、空标题）。
 * 用于把这类草稿归一成不带标题的空段落，覆盖存量脏数据（早期被强转的空 H1）。
 * 只看首块有无 inline 文本，不碰块类型 props——避免 isDraftEmpty 那种按 JSON 文本
 * 糊匹配、被 props 里 "default"/"left" 等拉丁字母值误判的问题。
 */
// 可承载 inline 文本、且空内容即视为「空白」的块类型。结构化块（image/table/
// codeBlock/file/video/audio…）不在此列：它们没有 inline content，内容在 props/rows 里，
// 单个结构化块是真实草稿，不能被当空白清掉。
const TEXTUAL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "callout",
]);

const isBlankSingleBlockDraft = (content: JSONContent | null): boolean => {
  if (!content) return true;
  if (!Array.isArray(content)) return false;
  if (content.length === 0) return true;
  if (content.length > 1) return false;
  const only = content[0] as {
    type?: string;
    content?: unknown;
    children?: unknown[];
  };
  if (Array.isArray(only.children) && only.children.length > 0) return false;
  // 仅对文本类块判空；结构化块一律保留（视为有内容）。
  if (!only.type || !TEXTUAL_BLOCK_TYPES.has(only.type)) return false;
  const inline = only.content;
  if (inline == null) return true; // 空段落/空标题：content 为 undefined
  if (typeof inline === "string") return inline.length === 0;
  if (Array.isArray(inline)) {
    return inline.every(
      (n) =>
        typeof (n as { text?: unknown })?.text !== "string" ||
        (n as { text: string }).text.length === 0,
    );
  }
  return false;
};

/** 造一个用于驱动编辑器的草稿 page（不入 pages map、不持久化为 page 快照）。 */
export function buildQuickNoteDraftPage(content: JSONContent | null): Page {
  const now = Date.now();
  // 空白草稿一律从空段落起手，不预置任何标题块——小窗是「草稿便签」，不走主窗
  // 「首块恒为 H1」约定。这里对「无可见文本」的草稿（null / 单个空块，含早期 normalize
  // 未豁免时把空段落强转空 H1 回写持久化所留下的存量脏数据）统一归一成空段落：
  // 既保证新草稿不冒空标题1，也清掉存量脏数据。注意此处用结构化判空而非 isDraftEmpty
  // ——后者按 JSON 文本糊匹配，块 props 里的 "default"/"left" 等值含拉丁字母会被误判为非空。
  const draftContent = isBlankSingleBlockDraft(content)
    ? createEmptyLocalPageContent()
    : (content as JSONContent);
  return {
    id: "__quicknote_draft__",
    workspaceId: DEFAULT_NOTEBOOK,
    parentId: undefined,
    content: draftContent,
    isFolder: false,
    isLocked: false,
    isFullWidth: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: now,
    updatedAt: now,
    order: now,
  };
}
