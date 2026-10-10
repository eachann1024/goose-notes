import type { StoreSet, StoreGet } from "../hydrate";
import { useNotebooks } from "../../../useNotebooks";
import { generateLocalPageId } from "./localPaths";
import type { Page } from "@/types";
import { syncLocalPageMetadataCache } from "../../persistence";
import { appendLocalFolderOrderEntries } from "@/stores/localFolderOrder";

export const createLocalFolderRecordAction = async (
  set: StoreSet,
  get: StoreGet,
  {
    workspaceId,
    parentId,
    title,
  }: {
    workspaceId: string;
    parentId?: string;
    title?: string;
  },
): Promise<string | null> => {
  const notebook = useNotebooks.getState().notebooks[workspaceId];
  if (
    !notebook?.localPath ||
    typeof window === "undefined" ||
    !window.gooseFs
  ) {
    return null;
  }

  const parentPage = parentId ? get().pages[parentId] : undefined;
  const baseDir =
    parentPage?.localFilePath && parentPage.isFolder
      ? parentPage.localFilePath
      : notebook.localPath;
  const normalizedBaseDir = baseDir.replace(/[\/\\]$/, "");
  const normalizedTitle = (
    (title || "新建文件夹").trim() || "新建文件夹"
  ).replace(/[\\/:*?"<>|]/g, "_");
  const folderPath = `${normalizedBaseDir}/${normalizedTitle}`;

  const exists = window.gooseFs.existsAsync
    ? await window.gooseFs.existsAsync(folderPath)
    : window.gooseFs.exists(folderPath);
  if (exists) return null;

  const created = window.gooseFs.mkdir
    ? await Promise.resolve(window.gooseFs.mkdir(folderPath))
    : false;
  if (!created) return null;

  const id = generateLocalPageId(workspaceId, folderPath);
  const now = Date.now();
  const newPage: Page = {
    id,
    workspaceId,
    parentId: parentPage?.isFolder ? parentId : undefined,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: normalizedTitle }],
        },
      ],
    },
    isFolder: true,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: folderPath,
    createdAt: now,
    updatedAt: now,
    order: now,
  };

  set((state) => ({
    pages: { ...state.pages, [id]: newPage },
  }));

  syncLocalPageMetadataCache(id, newPage);
  // 手动顺序目录：新建文件夹追加到末尾
  appendLocalFolderOrderEntries(workspaceId, [newPage]);
  return id;
};
