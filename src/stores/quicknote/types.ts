import type { JSONContent } from "@/types";
import type { QuickNoteSlotStacks } from "@/lib/quicknote/undoHistory";

/**
 * 速记小窗状态（独立窗口进程内使用）。
 *
 * 小窗与主窗是两个独立的 WebView 进程，但共享同一份 Electron db。小窗是「草稿便签」：
 * 不直接对应一条真实笔记，编辑内容只落到草稿存储，不写进 pages、不进笔记列表 / 搜索。
 * 用户点标题栏「保存到笔记」才把当前槽位草稿写入当前笔记本（本地文件夹则新建 .md），
 * 随后清空该槽位、撤销栈归零，编辑器回到空白初始状态。
 *
 * 支持 1–5 五个独立草稿槽位（activeSlot + drafts），各自持久化、互不覆盖，
 * 每个槽位名称（slotNames）也独立持久化。
 * 另持久化 pinned、editorZoom、windowWidth/windowHeight、windowX/windowY，
 * 以及每槽撤销/重做栈（关窗后 Ctrl/Cmd+Z 仍可回退）。
 * 当前正在编辑的 draftPage 是会话态（基于当前槽位草稿现造），不持久化。
 */
export type QuickNoteSlot = 1 | 2 | 3 | 4 | 5;

export const QUICKNOTE_SLOT_COUNT = 5;

export const QUICKNOTE_SLOTS: readonly QuickNoteSlot[] = [1, 2, 3, 4, 5];

export type QuickNoteDrafts = Record<QuickNoteSlot, JSONContent | null>;

export type QuickNoteSlotNames = Record<QuickNoteSlot, string>;

export interface QuickNoteState {
  /** 当前激活的草稿槽位（1–5） */
  activeSlot: QuickNoteSlot;
  /** 五个独立草稿内容（各自持久化） */
  drafts: QuickNoteDrafts;
  /** 五个草稿槽位的自定义名称；空字符串回退为“便签 N”。 */
  slotNames: QuickNoteSlotNames;
  /**
   * 每槽撤销栈（持久化）。栈顶是最近一步可回退到的内容快照。
   * 关窗后仍可继续 Ctrl/Cmd+Z。
   */
  undoStacks: QuickNoteSlotStacks;
  /**
   * 每槽重做栈（持久化）。撤销后写入；新编辑会清空。
   */
  redoStacks: QuickNoteSlotStacks;
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
   * 记住的窗口左上角 x/y（持久化，下次开窗沿用）。
   * preload 用 win.getBounds() 权威写入 db；web 侧拖动停下 / 关窗时经 setWindowPosition
   * 同步进 store，避免后续草稿 persist 用旧坐标覆盖。
   */
  windowX?: number;
  windowY?: number;
  /**
   * 编辑界面缩放比例（Cmd +/- 调整，持久化；下次开窗沿用）。
   * 与窗口像素尺寸无关：只缩放编辑内容视觉大小。
   */
  editorZoom: number;
  /** 切换当前草稿槽位（不改其它槽位内容） */
  setActiveSlot: (slot: QuickNoteSlot) => void;
  /** 重命名指定草稿槽位；空名称恢复默认“便签 N”。 */
  setSlotName: (slot: QuickNoteSlot, name: string) => void;
  /**
   * 草稿内容变更（编辑器 onContentChange 调用）。
   * 可显式指定 slot：切换槽位时旧编辑器卸载前的最后一次 onChange 仍写回原槽，避免串写。
   */
  setDraftContent: (
    content: JSONContent,
    slot?: QuickNoteSlot,
    options?: { recordHistory?: boolean },
  ) => void;
  /**
   * 撤销当前槽位一步。返回恢复后的内容；无历史时返回 null 且不改状态。
   * 注意：返回 null 既可能表示「无历史」，也可能表示恢复到空草稿——用 applied 语义
   * 时请改用 undoDraft 的 boolean 返回值。
   */
  undoDraft: () => { content: JSONContent | null; applied: boolean };
  /** 重做当前槽位一步。 */
  redoDraft: () => { content: JSONContent | null; applied: boolean };
  /**
   * 保存当前槽位草稿到当前笔记本：本地文件夹新建 .md，其它笔记本走 createPageRecord。
   * 成功后清空该槽位并丢掉撤销/重做，回到空白初始状态。
   * 草稿为空、没有当前笔记本、或写盘失败时返回 null，不改草稿。
   */
  saveDraftToNotebook: () => Promise<string | null>;
  /** 清空当前槽位草稿，回到空白便签。 */
  clearDraft: () => void;
  setWindowWidth: (width: number) => void;
  setWindowHeight: (height: number) => void;
  setWindowSize: (width: number, height: number) => void;
  /** 更新编辑界面缩放（持久化）。 */
  setEditorZoom: (zoom: number) => void;
  /**
   * 同步窗口屏幕坐标到 store（与 preload 权威写入配合）。
   * 子窗拖动停下后调用，避免后续 store persist 用旧/空坐标盖掉 preload 写的位置。
   */
  setWindowPosition: (x: number, y: number) => void;
}

/** 速记小窗默认宽度，与 preload QUICKNOTE_WIDTH 保持一致。 */
export const QUICKNOTE_DEFAULT_WIDTH = 480;

/** 速记小窗最小宽度，与 preload minWidth 保持一致。 */
export const QUICKNOTE_MIN_WIDTH = 320;

/** 速记小窗默认高度，与 preload QUICKNOTE_HEIGHT 保持一致。 */
export const QUICKNOTE_DEFAULT_HEIGHT = 350;

/** 速记小窗最小高度，与 preload QUICKNOTE_MIN_HEIGHT 保持一致。 */
export const QUICKNOTE_MIN_HEIGHT = 300;

/** 编辑界面缩放下限（Cmd -）。 */
export const QUICKNOTE_ZOOM_MIN = 0.7;

/** 编辑界面缩放上限（Cmd +）。 */
export const QUICKNOTE_ZOOM_MAX = 1.8;

/** 编辑界面缩放步进。 */
export const QUICKNOTE_ZOOM_STEP = 0.1;

/** 编辑界面默认缩放。 */
export const QUICKNOTE_ZOOM_DEFAULT = 1;

/** 把缩放值钳到合法范围，并四舍五入到 0.01，避免浮点漂移。 */
export function clampQuickNoteZoom(zoom: unknown): number {
  const n = typeof zoom === "number" ? zoom : Number(zoom);
  if (!Number.isFinite(n)) return QUICKNOTE_ZOOM_DEFAULT;
  const clamped = Math.min(QUICKNOTE_ZOOM_MAX, Math.max(QUICKNOTE_ZOOM_MIN, n));
  return Math.round(clamped * 100) / 100;
}
