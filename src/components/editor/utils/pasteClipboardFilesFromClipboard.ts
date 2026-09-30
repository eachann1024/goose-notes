import type { BlockNoteEditor } from "@blocknote/core";
import type { PartialBlock } from "@blocknote/core/blocks";
import { materializeImageBlob } from "@/lib/imageProcessor";
import {
  isPasteableClipboardImageFile,
  isPasteableClipboardVideoFile,
  resolveImageMimeForUpload,
} from "./pasteClipboardImage";
import { toast } from "@/components/ui/sonner";

function insertOrUpdateBlock(
  editor: BlockNoteEditor<any, any, any>,
  referenceBlock: { id: string; content?: unknown },
  newBlock: PartialBlock<any, any, any>,
  placement: "before" | "after" = "after",
): string {
  const ref = referenceBlock as Parameters<typeof editor.updateBlock>[0];
  if (
    Array.isArray(referenceBlock.content) &&
    referenceBlock.content.length === 0
  ) {
    return editor.updateBlock(ref, newBlock).id;
  }
  return editor.insertBlocks([newBlock], ref, placement)[0].id;
}

function resolveImageBlockType(editor: BlockNoteEditor<any, any, any>): string {
  if (editor.schema.blockSpecs.imageResize) return "imageResize";
  return "image";
}

/**
 * 插入空媒体块（及末尾补段）合成一次 undo。
 * 上传完成后的 url 必须走 {@link commitPastedMediaWithoutHistory}，
 * 否则撤回只会撤掉 url，留下「添加图片」空块。
 */
function insertPastedMediaPlaceholder(
  editor: BlockNoteEditor<any, any, any>,
  referenceBlock: { id: string; content?: unknown },
  fileBlock: PartialBlock<any, any, any>,
): string {
  return editor.transact(() => {
    const insertedBlockId = insertOrUpdateBlock(
      editor,
      referenceBlock,
      fileBlock,
    );

    // 视频/图片 void 块若落在文档末尾，补一行空段落，避免无法在下方继续输入
    try {
      const last = editor.document.at(-1);
      if (last?.id === insertedBlockId) {
        editor.insertBlocks(
          [{ type: "paragraph", content: "" }],
          insertedBlockId,
          "after",
        );
      }
    } catch {
      // ignore
    }

    return insertedBlockId;
  });
}

function commitPastedMediaWithoutHistory(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
  update: PartialBlock<any, any, any>,
): void {
  editor.transact((tr) => {
    tr.setMeta("addToHistory", false);
    editor.updateBlock(blockId, update);
  });
}

/**
 * Mac 剪贴板常无 dataTransfer.types 中的 "Files"（仅有 image/png 等），
 * BlockNote handleFileInsertion 会直接 return；此处遍历 items 插入并 uploadFile。
 */
export async function pasteClipboardFilesFromClipboard(
  event: ClipboardEvent,
  editor: BlockNoteEditor<any, any, any>,
): Promise<void> {
  const data = event.clipboardData;
  if (!data?.items?.length || !editor.uploadFile) return;

  event.preventDefault();

  const currentBlock = editor.getTextCursorPosition().block;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;

    const isImage = isPasteableClipboardImageFile(file, item.type);
    const editorCompact =
      typeof __GOOSE_EDITOR_COMPACT__ !== "undefined" &&
      __GOOSE_EDITOR_COMPACT__;
    const isVideo =
      !editorCompact && isPasteableClipboardVideoFile(file, item.type);
    if (!isImage && !isVideo) continue;

    const type = isVideo ? "video" : resolveImageBlockType(editor);

    const fileBlock = {
      type,
      props: { name: file.name || (isVideo ? "video.mp4" : "image.webp") },
    } as PartialBlock<any, any, any>;

    const insertedBlockId = insertPastedMediaPlaceholder(
      editor,
      currentBlock,
      fileBlock,
    );

    try {
      // 图片需先固化字节并修正 MIME；视频直接交给 FFmpeg 转码。
      const uploadFile = isVideo
        ? file
        : new File(
            [
              await materializeImageBlob(
                file,
                resolveImageMimeForUpload(file) || item.type || "image/png",
              ),
            ],
            file.name || `paste-${Date.now()}.png`,
            {
              type: resolveImageMimeForUpload(file) || item.type || "image/png",
            },
          );
      const updateData = await editor.uploadFile(uploadFile, insertedBlockId);
      if (!editor.getBlock(insertedBlockId)) return;
      const updatedFileBlock =
        typeof updateData === "string"
          ? ({ props: { url: updateData } } as PartialBlock<any, any, any>)
          : { ...updateData };
      commitPastedMediaWithoutHistory(editor, insertedBlockId, updatedFileBlock);
    } catch (err) {
      if (!editor.getBlock(insertedBlockId)) return;
      console.error("[pasteClipboardFiles] upload failed", err);
      editor.removeBlocks([insertedBlockId]);
      const message =
        err instanceof Error && err.message
          ? err.message
          : isVideo
            ? "视频粘贴失败，请稍后重试"
            : "图片粘贴失败，请稍后重试";
      toast.error(message);
    }
  }
}
