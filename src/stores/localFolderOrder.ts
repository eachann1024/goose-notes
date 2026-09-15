/**
 * localFolderOrder —— 本地文件夹（local-folder）目录排序
 *
 * 每个目录（含笔记本根）默认按名称排序（文件夹优先）；某目录内首次有效手动拖动后
 * 切为手动顺序并落盘，此后扫描发现 / 新建 / 移入的条目一律追加到末尾，
 * 应用内重命名不改 pageId，所以位置不动。
 *
 * 顺序按 (notebookId, dirKey) 存，dirKey = 父目录 pageId，笔记本根用
 * LOCAL_FOLDER_ROOT_DIR_KEY；存储 key `gn:local-order:{notebookId}`
 * （localDbStorage，底层是 localStorage）。只影响本地文件夹的这一个目录，
 * 普通笔记本的 Page.order 与收藏顺序都不动。
 */
import { create } from "zustand";
import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { toast } from "@/components/ui/sonner";
import {
  readDbStorageJSON,
  removeDbStorageItem,
  writeDbStorageJSON,
} from "@/lib/storage/localDbStorage";

const ORDER_KEY_PREFIX = "gn:local-order:";

/** 笔记本根目录没有父页面，用固定 dirKey。 */
export const LOCAL_FOLDER_ROOT_DIR_KEY = "root";

/** 目录键 → 该目录子项 pageId 有序数组；存在即表示该目录处于手动顺序。 */
export type LocalFolderOrderMap = Record<string, string[]>;

interface LocalFolderOrderState {
  ordersByNotebook: Record<string, LocalFolderOrderMap>;
}

export const useLocalFolderOrders = create<LocalFolderOrderState>()(() => ({
  ordersByNotebook: {},
}));

function storageKey(notebookId: string): string {
  return `${ORDER_KEY_PREFIX}${notebookId}`;
}

function dirKeyOf(parentId: string | undefined): string {
  return parentId ?? LOCAL_FOLDER_ROOT_DIR_KEY;
}

function putInState(notebookId: string, orders: LocalFolderOrderMap): void {
  useLocalFolderOrders.setState((state) => ({
    ordersByNotebook: { ...state.ordersByNotebook, [notebookId]: orders },
  }));
}

/** 落盘成功才更新内存：写失败就报错，不能让界面假装已保存。 */
function persist(notebookId: string, orders: LocalFolderOrderMap): boolean {
  if (!writeDbStorageJSON(storageKey(notebookId), orders)) {
    toast.error("排序保存失败", {
      description: "本地存储写入失败，本次排序没有生效。",
    });
    return false;
  }
  putInState(notebookId, orders);
  return true;
}

/** 存储可能被旧版本或外部写入破坏：只收下「目录键 → 去重后的非空字符串 id 数组」。 */
function sanitizeOrders(raw: unknown): LocalFolderOrderMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const orders: LocalFolderOrderMap = {};
  for (const [dirKey, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    orders[dirKey] = [
      ...new Set(
        value.filter((id): id is string => typeof id === "string" && !!id),
      ),
    ];
  }
  return orders;
}

/** 某记事本当前已知的手动顺序（未加载 / 无手动顺序时为 {}）。 */
export function getLocalFolderOrders(
  notebookId: string | null | undefined,
): LocalFolderOrderMap {
  if (!notebookId) return {};
  return useLocalFolderOrders.getState().ordersByNotebook[notebookId] ?? {};
}

/**
 * 把手动顺序从存储读进内存（含边界消毒）。在本地文件夹加载流程里调用一次即可；
 * 未加载时排序按名称处理，加载完成后订阅方会自动重渲染。
 */
export function ensureLocalFolderOrdersLoaded(notebookId: string): void {
  if (useLocalFolderOrders.getState().ordersByNotebook[notebookId]) return;
  putInState(
    notebookId,
    sanitizeOrders(readDbStorageJSON<unknown>(storageKey(notebookId), {})),
  );
}

/** 目录内拖动排序后写入手动顺序：该目录从此进入手动模式。 */
export function setLocalFolderOrder(
  notebookId: string,
  dirKey: string,
  ids: string[],
): boolean {
  return persist(notebookId, {
    ...getLocalFolderOrders(notebookId),
    [dirKey]: [...ids],
  });
}

/** 恢复名称排序：清掉该目录的手动顺序，其他目录不受影响。 */
export function clearLocalFolderOrder(notebookId: string, dirKey: string): boolean {
  const current = getLocalFolderOrders(notebookId);
  if (!(dirKey in current)) return false;
  const next = { ...current };
  delete next[dirKey];
  return persist(notebookId, next);
}

/** 删除本地记事本 / 清空本地数据时一并清理。 */
export function removeLocalFolderOrders(notebookId: string): void {
  // 清理属尽力而为：内存必须跟着删除动作清空，避免残留顺序污染重建后的库
  removeDbStorageItem(storageKey(notebookId));
  useLocalFolderOrders.setState((state) => {
    const next = { ...state.ordersByNotebook };
    delete next[notebookId];
    return { ordersByNotebook: next };
  });
}

/**
 * 新条目（扫描发现 / 新建 / 物化 / watch 增量）追加到所属目录手动序末尾并落盘，
 * 位置从此稳定：后续再新增不会挤到它前面。只动处于手动顺序的目录；
 * 草稿与待创建占位跳过（它们还不是最终 id）。
 */
export function appendLocalFolderOrderEntries(
  notebookId: string,
  pages: Iterable<Page>,
): void {
  const orders = getLocalFolderOrders(notebookId);
  const additions = new Map<string, string[]>();
  for (const page of pages) {
    if (page.localUnsaved || page.localPendingCreate) continue;
    const dirKey = dirKeyOf(page.parentId);
    if (!orders[dirKey]) continue;
    const ids = additions.get(dirKey) ?? [];
    if (!ids.includes(page.id)) ids.push(page.id);
    additions.set(dirKey, ids);
  }
  if (additions.size === 0) return;

  const next = { ...orders };
  let changed = false;
  for (const [dirKey, ids] of additions) {
    const known = new Set(next[dirKey]);
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length === 0) continue;
    next[dirKey] = [...next[dirKey], ...missing];
    changed = true;
  }
  if (changed) persist(notebookId, next);
}

/**
 * 移动成功后调整顺序：清源目录旧槽位，追加到目标目录末尾（仅手动顺序的目录）。
 * 移动失败不要调用，否则顺序会和磁盘不一致。
 */
export function reassignLocalFolderOrder(
  notebookId: string,
  pageId: string,
  fromParentId: string | undefined,
  toParentId: string | undefined,
): void {
  const fromKey = dirKeyOf(fromParentId);
  const toKey = dirKeyOf(toParentId);
  if (fromKey === toKey) return;
  const orders = getLocalFolderOrders(notebookId);
  if (!orders[fromKey] && !orders[toKey]) return;

  const next = { ...orders };
  let changed = false;
  if (next[fromKey]?.includes(pageId)) {
    next[fromKey] = next[fromKey].filter((id) => id !== pageId);
    changed = true;
  }
  if (next[toKey] && !next[toKey].includes(pageId)) {
    next[toKey] = [...next[toKey], pageId];
    changed = true;
  }
  if (changed) persist(notebookId, next);
}

/** 订阅某目录是否处于手动顺序（决定「恢复名称排序」入口是否出现）。 */
export function useLocalFolderManualOrder(
  notebookId: string | null | undefined,
  dirKey: string | undefined,
): boolean {
  return useLocalFolderOrders((state) => {
    if (!notebookId || !dirKey) return false;
    return dirKey in (state.ordersByNotebook[notebookId] ?? {});
  });
}

function compareNames(a: Page, b: Page): number {
  const byName = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
    numeric: true,
  });
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

/**
 * 本地文件夹子项排序，侧栏树与目录主页共用，保证两处顺序一致。
 * - 无手动顺序：文件夹优先，再按名称（与访达一致）；
 * - 有手动顺序：按手动顺序，不在表内的项（尚未追加进顺序的新条目）排末尾。
 * 两种模式都不看 Page.order，扫描刷新不会打乱顺序。
 */
export function sortLocalFolderChildren(
  pages: Page[],
  manualOrder: string[] | undefined,
): Page[] {
  const rank = manualOrder
    ? new Map(manualOrder.map((id, index) => [id, index]))
    : null;
  const unknownRank = rank ? rank.size : 0;

  return [...pages].sort((a, b) => {
    if (!!a.localPendingCreate !== !!b.localPendingCreate) {
      return a.localPendingCreate ? -1 : 1;
    }
    if (rank) {
      const rankA = rank.get(a.id) ?? unknownRank;
      const rankB = rank.get(b.id) ?? unknownRank;
      if (rankA !== rankB) return rankA - rankB;
    } else if (!!a.isFolder !== !!b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return compareNames(a, b);
  });
}

/**
 * 同目录拖动落点 → 新的手动顺序并落盘。
 * @param insertIndex react-complex-tree 给的子项下标（基于含被拖项的列表）
 * @returns 是否真的写入了新顺序；落回原位（或写盘失败）返回 false，不切手动模式
 */
export function applyLocalFolderReorder(
  notebookId: string,
  dirKey: string,
  children: Page[],
  movedIds: string[],
  insertIndex: number,
): boolean {
  const manualOrder = getLocalFolderOrders(notebookId)[dirKey];
  const current = sortLocalFolderChildren(children, manualOrder).map(
    (page) => page.id,
  );

  // 落点下标基于含被拖项的列表，过滤后 splice 前要补偿前面被移除的项数
  let index = insertIndex;
  if (index > 0) {
    index -= movedIds.filter((id) => {
      const at = current.indexOf(id);
      return at >= 0 && at < index;
    }).length;
  }

  const rest = current.filter((id) => !movedIds.includes(id));
  const next =
    index < 0
      ? [...rest, ...movedIds]
      : [...rest.slice(0, index), ...movedIds, ...rest.slice(index)];

  if (next.join("\n") === current.join("\n")) return false;
  return setLocalFolderOrder(notebookId, dirKey, next);
}
