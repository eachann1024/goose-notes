import type { JSONContent } from "@/types";
import { jsonContentToMarkdown } from "@/lib/export";
import { normalizePageContent } from "@/lib/blocknote-content";
import { isLocalFolderPage } from "../../persistence";
import {
  flushPendingLocalSaveByPageIdInternal,
  flushAllPendingLocalSavesInternal,
} from "../../folderSync";
import type { StoreSet, StoreGet } from "../hydrate";
import { clonePageContent } from "../pageCreate";

function mergePageContent(base: JSONContent, addition: JSONContent): JSONContent {
  const baseBlocks = normalizePageContent(base);
  const additionBlocks = normalizePageContent(addition);
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
    ...(needsSpacer ? ([{ type: "paragraph", content: "" }] as JSONContent) : []),
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

  get().updatePage(pageId, {
    content: clonePageContent(content),
  });

  if (isLocalFolderPage(page)) {
    // 程序化写入（AI 等）不走 dirty 队列：直接落盘并清掉 dirty 标记。
    const saved = await get().saveLocalPageContent(
      pageId,
      clonePageContent(content),
    );
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

  const mergedContent = mergePageContent(
    clonePageContent(page.content),
    clonePageContent(content),
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
  const endIdx = sourceBlocks.findIndex(
    (block) => block?.id === endBlockId,
  );
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return false;

  const replacementBlocks = Array.isArray(newBlocks)
    ? (newBlocks as any[])
    : Array.isArray((newBlocks as any)?.content)
      ? ((newBlocks as any).content as any[])
      : [];
  if (!replacementBlocks.length) return false;

  const clonedSource = clonePageContent(sourceContent as JSONContent) as any[];
  const cloneArr = Array.isArray(clonedSource) ? clonedSource : [];
  const head = cloneArr.slice(0, startIdx);
  const tail = cloneArr.slice(endIdx + 1);
  const replacement = JSON.parse(JSON.stringify(replacementBlocks)).map(
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

export const saveLocalPageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
): Promise<boolean> => {
  if (typeof window === "undefined" || !window.gooseFs)
    return false;

  const page = get().pages[pageId];
  if (!page) return false;

  const filePath = get().getLocalFilePath(pageId);
  if (!filePath) return false;

  const processedContent = content;

  const assetsDir = filePath.replace(/[^\/\\]+$/, "") + "assets";
  try {
    if (window.gooseFs.mkdir) {
      await window.gooseFs.mkdir(assetsDir);
    }
  } catch {}

  const writePromises: Promise<any>[] = [];

  const processImages = (nodes: any[]) => {
    nodes.forEach((node) => {
      if (
        (node.type === "image" || node.type === "imageResize") &&
        node.attrs?.src?.startsWith("data:image")
      ) {
        const match = node.attrs.src.match(
          /^data:(image\/([a-zA-Z+]+));base64,(.+)$/,
        );
        if (match) {
          const ext = match[2] === "jpeg" ? "jpg" : match[2];
          const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
          const imagePath = `${assetsDir}/${filename}`;

          if (window.gooseFs?.writeFileAsync) {
            writePromises.push(window.gooseFs.writeFileAsync(imagePath, match[3], "base64"));
          } else {
            window.gooseFs?.writeFile(imagePath, match[3]);
          }

          node.attrs.src = `./assets/${filename}`;
        }
      }
      if (node.content) {
        processImages(node.content);
      }
    });
  };

  if (processedContent.content) {
    processImages(processedContent.content);
  }

  if (writePromises.length > 0) {
    await Promise.all(writePromises);
  }

  const markdownContent = jsonContentToMarkdown(processedContent);

  if (!markdownContent.trim()) {
    let exists = false;
    try { exists = window.gooseFs?.exists(filePath) ?? false; } catch {}

    if (exists) {
      let oldContent = "";
      if (window.gooseFs?.readFileAsync) {
        oldContent = await window.gooseFs.readFileAsync(filePath) || "";
      } else {
        oldContent = window.gooseFs?.readFile(filePath) || "";
      }

      if (oldContent && oldContent.trim().length > 10) {
        console.error("[Data Integrity] Refusing to save empty content.");
        return false;
      }
    }
  }

  let result: boolean;
  if (window.gooseFs?.writeFileAsync) {
    result = await window.gooseFs.writeFileAsync(filePath, markdownContent);
  } else {
    result = window.gooseFs?.writeFile(filePath, markdownContent) ?? false;
  }

  if (result) {
    set({ lastSavedAt: Date.now() });
  }
  return result;
};

export const flushPendingLocalSaveByPageIdAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
) => {
  await flushPendingLocalSaveByPageIdInternal(pageId, get);
  set((s) => ({ dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false } }));
};

export const flushPendingLocalSavesAction = async (
  set: StoreSet,
  get: StoreGet,
) => {
  await flushAllPendingLocalSavesInternal(get);
};

export const isLocalPageDirtyAction = (
  get: StoreGet,
  pageId: string,
): boolean => {
  return Boolean(get().dirtyLocalPageIds[pageId]);
};
