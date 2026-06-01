import type { JSONContent } from "@/types";
import { blocksToMarkdown } from "@/lib/export";
import { normalizePageContent } from "@/components/editor/utils/blocknote-content";
import { extractFrontmatter } from "@/lib/markdown-raw-guard";
import { isLocalFolderPage } from "../../persistence";
import {
  flushPendingLocalSaveByPageIdInternal,
  flushAllPendingLocalSavesInternal,
} from "../../folderSync";
import type { StoreSet, StoreGet } from "../hydrate";
import { clonePageContent } from "../pageCreate";

// FNV-1a 32 位哈希（含长度），用于按内容给图片附件命名以实现去重。
function hashBase64(data: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + data.length.toString(36);
}

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
  const replacement = clonePageContent(replacementBlocks as JSONContent).map(
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
          // 按内容哈希命名以去重：相同图片只落盘一次，避免反复保存产生重复文件。
          const base64Data = match[3];
          const filename = `img_${hashBase64(base64Data)}.${ext}`;
          const imagePath = `${assetsDir}/${filename}`;

          let alreadyExists = false;
          try {
            alreadyExists = window.gooseFs?.exists?.(imagePath) ?? false;
          } catch {}

          if (!alreadyExists) {
            if (window.gooseFs?.writeFileAsync) {
              writePromises.push(window.gooseFs.writeFileAsync(imagePath, base64Data, "base64"));
            } else {
              window.gooseFs?.writeFile(imagePath, base64Data);
            }
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

  const markdownContent = await blocksToMarkdown(processedContent as any);

  // scanner 抽出 frontmatter 后不入编辑器，保存时由这里 prepend 回去
  // （否则首次保存就把 frontmatter 丢了）
  const finalContent = page.localFrontmatter
    ? `${page.localFrontmatter}\n\n${markdownContent}`
    : markdownContent;

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

      // 判断旧文件是否还有实质 body（去掉 frontmatter 后），避免误判 frontmatter 自身为有效内容
      const { body: oldBody } = extractFrontmatter(oldContent);
      if (oldBody && oldBody.trim().length > 10) {
        console.error("[Data Integrity] Refusing to save empty content.");
        return false;
      }
    }
  }

  let result: boolean;
  if (window.gooseFs?.writeFileAsync) {
    result = await window.gooseFs.writeFileAsync(filePath, finalContent);
  } else {
    result = window.gooseFs?.writeFile(filePath, finalContent) ?? false;
  }

  if (result) {
    // 落盘成功即清除脏标记（自动保存与显式保存共用此路径）。
    set((s) => ({
      lastSavedAt: Date.now(),
      dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
    }));
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
