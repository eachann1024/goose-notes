export interface Notebook {
  id: string;
  name: string;
  icon?: string; // emoji 或 Lucide 图标名
  createdAt: number;
  updatedAt: number;
  /** 用户自定义排序；缺省时回退 createdAt */
  order?: number;
  source?: "default" | "local-folder";
  localPath?: string; // 本地文件夹路径
  localPathMissing?: boolean;
  /** 开启后不出现在「所有记事本」全局搜索；当前本搜索仍可见 */
  excludeFromGlobalSearch?: boolean;
}

/** 按 order（缺省 createdAt）升序；同值再用 createdAt 稳定排序 */
export function sortNotebooksByOrder(
  notebooks: Record<string, Notebook>,
): Notebook[] {
  return Object.values(notebooks).sort((a, b) => {
    const orderA = a.order ?? a.createdAt;
    const orderB = b.order ?? b.createdAt;
    if (orderA !== orderB) return orderA - orderB;
    return a.createdAt - b.createdAt;
  });
}

export function nextNotebookOrder(notebooks: Record<string, Notebook>): number {
  const list = Object.values(notebooks);
  if (list.length === 0) return 0;
  return Math.max(...list.map((n) => n.order ?? n.createdAt)) + 1;
}

export type LocalFolderLoadStatus = "idle" | "loading" | "ready" | "error";

export interface LocalFolderLoadState {
  status: LocalFolderLoadStatus;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export const IDLE_LOCAL_FOLDER_LOAD_STATE: LocalFolderLoadState = {
  status: "idle",
};

export interface NotebooksState {
  notebooks: Record<string, Notebook>;
  activeNotebookId: string | null;
  lastActivePageByNotebook: Record<string, string | null>;
  localFolderLoadStates: Record<string, LocalFolderLoadState>;

  createNotebook: (
    name?: string,
    icon?: string,
    overrideIfExists?: boolean,
    customId?: string,
  ) => string;
  createLocalFolderNotebook: (name: string, localPath: string) => string;
  updateNotebook: (
    id: string,
    updates: Partial<Omit<Notebook, "id" | "createdAt">>,
  ) => void;
  deleteNotebook: (id: string) => void;
  reorderNotebooks: (orderedIds: string[]) => void;
  setActiveNotebook: (id: string) => void;
  getNotebook: (id: string) => Notebook | undefined;
  setLastActivePage: (notebookId: string, pageId: string | null) => void;
  getLastActivePage: (notebookId: string) => string | null;
  setLocalFolderLoadState: (
    notebookId: string,
    state: LocalFolderLoadState,
  ) => void;
  getLocalFolderLoadState: (notebookId: string) => LocalFolderLoadState;
}

// 生成唯一ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 默认记事本
export const DEFAULT_NOTEBOOK_ID = "default-notebook";

// Electron 桌面端为「仅本地文件夹」模式：无内置笔记本，数据层不种 default-notebook。
// 宿主标记未注入时保留浏览器默认行为。
export const isElectronHost =
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

export const DEFAULT_NOTEBOOK = DEFAULT_NOTEBOOK_ID;
