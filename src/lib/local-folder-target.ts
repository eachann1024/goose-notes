import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";

const RECENT_TARGETS_KEY = "goose-local-folder-recent-targets";
const MAX_RECENT_TARGETS = 5;

export type LocalFolderTargetKey = "root" | string;

export type LocalFolderPickerItem = {
  key: LocalFolderTargetKey;
  folderId: string | undefined;
  label: string;
  pathLabel: string;
};

export function isExternalFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).includes("Files");
}

/** 侧栏选中页的父目录 */
export function getPageParentDirectoryId(page: Page): string | undefined {
  return page.parentId;
}

/** 页面所在目录（文件→父文件夹；文件夹→自身） */
export function getPageContainingFolderId(page: Page): string | undefined {
  return page.isFolder ? page.id : page.parentId;
}

export function resolveDropTargetParentId(
  workspaceId: string,
  dropTargetPageId: string | null | undefined,
): string | undefined | null {
  if (dropTargetPageId === null) return null;
  if (!dropTargetPageId) return null;
  const page = usePages.getState().pages[dropTargetPageId];
  if (!page || page.workspaceId !== workspaceId || page.trashedAt) return null;
  return page.isFolder ? page.id : page.parentId;
}

export function resolveLocalFolderImportParentId(
  workspaceId: string,
  dropTargetPageId?: string | null,
): string | undefined {
  const fromDrop = resolveDropTargetParentId(workspaceId, dropTargetPageId);
  if (fromDrop !== null) return fromDrop ?? undefined;

  const pages = usePages.getState().pages;
  const selectedId =
    useSidebarView.getState().selectedByNotebook[workspaceId] ?? null;
  const activePageId = usePages.getState().activePageId;

  if (selectedId) {
    const selected = pages[selectedId];
    if (selected && selected.workspaceId === workspaceId && !selected.trashedAt) {
      return getPageParentDirectoryId(selected);
    }
  }

  if (activePageId) {
    const active = pages[activePageId];
    if (active && active.workspaceId === workspaceId && !active.trashedAt) {
      return getPageContainingFolderId(active);
    }
  }

  return undefined;
}

export function isDescendantPage(
  pages: Record<string, Page>,
  ancestorId: string,
  candidateId: string,
): boolean {
  let current: string | undefined = candidateId;
  while (current) {
    if (current === ancestorId) return true;
    current = pages[current]?.parentId;
  }
  return false;
}

export function buildLocalFolderPickerItems(
  pages: Record<string, Page>,
  workspaceId: string,
  options: {
    query: string;
    excludePageId?: string;
    recentKeys?: LocalFolderTargetKey[];
  },
): LocalFolderPickerItem[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const recentKeys = options.recentKeys ?? [];
  const items: LocalFolderPickerItem[] = [];
  const seen = new Set<LocalFolderTargetKey>();

  const pushItem = (item: LocalFolderPickerItem) => {
    if (seen.has(item.key)) return;
    if (
      options.excludePageId &&
      item.folderId &&
      (item.folderId === options.excludePageId ||
        isDescendantPage(pages, options.excludePageId, item.folderId))
    ) {
      return;
    }
    if (normalizedQuery) {
      const haystack = `${item.label} ${item.pathLabel}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return;
    }
    seen.add(item.key);
    items.push(item);
  };

  pushItem({
    key: "root",
    folderId: undefined,
    label: "仓库根目录",
    pathLabel: "/",
  });

  for (const key of recentKeys) {
    if (key === "root") {
      pushItem({
        key: "root",
        folderId: undefined,
        label: "仓库根目录",
        pathLabel: "/",
      });
      continue;
    }
    const page = pages[key];
    if (!page?.isFolder || page.workspaceId !== workspaceId || page.trashedAt) {
      continue;
    }
    pushItem({
      key,
      folderId: key,
      label: getPageTitle(page) || "文件夹",
      pathLabel: page.localFilePath ?? key,
    });
  }

  const folders = Object.values(pages)
    .filter(
      (page) =>
        page.workspaceId === workspaceId &&
        page.isFolder &&
        !page.trashedAt &&
        page.localFilePath,
    )
    .sort((a, b) =>
      (a.localFilePath ?? "").localeCompare(b.localFilePath ?? "", undefined, {
        sensitivity: "base",
      }),
    );

  for (const folder of folders) {
    pushItem({
      key: folder.id,
      folderId: folder.id,
      label: getPageTitle(folder) || "文件夹",
      pathLabel: folder.localFilePath ?? folder.id,
    });
  }

  return items;
}

export function readRecentLocalFolderTargets(
  workspaceId: string,
): LocalFolderTargetKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_TARGETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, LocalFolderTargetKey[]>;
    return Array.isArray(parsed[workspaceId])
      ? parsed[workspaceId].slice(0, MAX_RECENT_TARGETS)
      : [];
  } catch {
    return [];
  }
}

export function rememberLocalFolderTarget(
  workspaceId: string,
  folderId: string | undefined,
): void {
  if (typeof window === "undefined") return;
  const key: LocalFolderTargetKey = folderId ?? "root";
  try {
    const raw = window.localStorage.getItem(RECENT_TARGETS_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, LocalFolderTargetKey[]>)
      : {};
    const current = Array.isArray(parsed[workspaceId])
      ? parsed[workspaceId]
      : [];
    const next = [key, ...current.filter((item) => item !== key)].slice(
      0,
      MAX_RECENT_TARGETS,
    );
    parsed[workspaceId] = next;
    window.localStorage.setItem(RECENT_TARGETS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore quota / parse errors
  }
}
