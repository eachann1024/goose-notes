import type { JSONContent } from "@/types";
import { normalizePageContent } from "@/components/editor/utils/blocknote-content";
import type { StoreSet, StoreGet } from "../../hydrate";
import { isLocalFolderPage } from "../../../persistence";
import { cloneLocalPageContent, clonePageContent } from "../../pageCreate";

export function mergePageContent(
  base: JSONContent,
  addition: JSONContent,
  opts?: { ensureFirstTitle?: boolean },
): JSONContent {
  const baseBlocks = normalizePageContent(base, opts);
  const additionBlocks = normalizePageContent(addition, opts);
  if (!additionBlocks.length) {
    return baseBlocks;
  }

  const lastBlock = baseBlocks.at(-1);
  const firstAdditionBlock = additionBlocks[0];
  const needsSpacer =
    baseBlocks.length > 0 &&
    lastBlock?.type !== "paragraph" &&
    firstAdditionBlock?.type !== "paragraph";

  return [
    ...baseBlocks,
    ...(needsSpacer
      ? ([{ type: "paragraph", content: "" }] as JSONContent)
      : []),
    ...additionBlocks,
  ];
}

export const writePageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
  _mode: "replace" = "replace",
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  const isLocal = isLocalFolderPage(page);
  get().updatePage(pageId, {
    content: isLocal
      ? cloneLocalPageContent(content)
      : clonePageContent(content),
  });

  if (isLocal) {
    // 程序化写入（AI 等）不走 dirty 队列：直接落盘并清掉 dirty 标记。
    let saved: boolean;
    try {
      saved = await get().saveLocalPageContent(
        pageId,
        cloneLocalPageContent(content),
      );
    } catch {
      return false;
    }
    if (saved) {
      set((s) => ({
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
      }));
    }
    return saved;
  }

  return true;
};

export const appendPageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  const isLocal = isLocalFolderPage(page);
  const mergeOpts = isLocal ? { ensureFirstTitle: false } : undefined;
  const mergedContent = mergePageContent(
    isLocal
      ? cloneLocalPageContent(page.content)
      : clonePageContent(page.content),
    isLocal ? cloneLocalPageContent(content) : clonePageContent(content),
    mergeOpts,
  );

  return await get().writePageContent(pageId, mergedContent);
};

export const replaceBlockRangeAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  startBlockId: string,
  endBlockId: string,
  newBlocks: JSONContent,
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  const sourceContent = page.content as unknown;
  const sourceBlocks = Array.isArray(sourceContent)
    ? (sourceContent as any[])
    : Array.isArray((sourceContent as any)?.content)
      ? ((sourceContent as any).content as any[])
      : null;
  if (!sourceBlocks) return false;

  const startIdx = sourceBlocks.findIndex(
    (block) => block?.id === startBlockId,
  );
  const endIdx = sourceBlocks.findIndex((block) => block?.id === endBlockId);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return false;

  const replacementBlocks = Array.isArray(newBlocks)
    ? (newBlocks as any[])
    : Array.isArray((newBlocks as any)?.content)
      ? ((newBlocks as any).content as any[])
      : [];
  if (!replacementBlocks.length) return false;

  const isLocal = isLocalFolderPage(page);
  const cloner = isLocal ? cloneLocalPageContent : clonePageContent;
  const clonedSource = cloner(sourceContent as JSONContent) as any[];
  const cloneArr = Array.isArray(clonedSource) ? clonedSource : [];
  const head = cloneArr.slice(0, startIdx);
  const tail = cloneArr.slice(endIdx + 1);
  const replacement = cloner(replacementBlocks as JSONContent).map(
    (block: any) => {
      if (block && typeof block === "object" && "id" in block) {
        const { id: _omit, ...rest } = block;
        void _omit;
        return rest;
      }
      return block;
    },
  );

  const nextContent = [...head, ...replacement, ...tail] as JSONContent;
  return await get().writePageContent(pageId, nextContent);
};
