import { useCallback, useState, type RefObject } from "react";
import { toast } from "sonner";
import { commitAgentArtifact } from "@/agent/core/runtime";
import type { EditorRef } from "@/components/editor/core/Editor";
import type { MarkdownNoteArtifact } from "@/agent/core/types";

interface UseAiWriteActionsParams {
  editorRef?: RefObject<EditorRef | null>;
  activeNotebookId: string | null | undefined;
  activePageId: string | null | undefined;
  updateMessageArtifact: (messageId: string, updater: (artifact: MarkdownNoteArtifact) => MarkdownNoteArtifact) => void;
}

export function useAiWriteActions({
  editorRef,
  activeNotebookId,
  activePageId,
  updateMessageArtifact,
}: UseAiWriteActionsParams) {
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);

  const handleConfirmWrite = useCallback(
    async (messageId: string, artifact: MarkdownNoteArtifact) => {
      setApplyingMessageId(messageId);

      try {
        const editor = editorRef?.current?.editor;
        const canUseEditor =
          editor &&
          (artifact.plan.action === "replace_page" || artifact.plan.action === "append_page") &&
          artifact.plan.target.pageId === activePageId &&
          artifact.plan.outputMarkdown;

        if (canUseEditor) {
          if (artifact.plan.action === "replace_page") {
            // 保留标题块，删除其余内容
            const allBlocks = editor.document;
            const titleBlock = allBlocks[0];
            const blocksToRemove = allBlocks.slice(1);
            if (blocksToRemove.length) editor.removeBlocks(blocksToRemove);
            // 光标定位到标题块末尾，pasteMarkdown 在光标处插入
            if (titleBlock) {
              editor.setTextCursorPosition(titleBlock, "end");
            }
            // 如果 AI 输出以 H1 开头，去掉它（标题块已保留）
            let md = artifact.plan.outputMarkdown;
            const h1Match = md.match(/^#\s+.+\n?/);
            if (h1Match) {
              md = md.slice(h1Match[0].length);
            }
            editor.pasteMarkdown(md);
          } else {
            // append: 光标定位到末尾
            const allBlocks = editor.document;
            const lastBlock = allBlocks[allBlocks.length - 1];
            if (lastBlock) {
              editor.setTextCursorPosition(lastBlock, "end");
            }
            editor.pasteMarkdown(artifact.plan.outputMarkdown);
          }

          updateMessageArtifact(messageId, (currentArtifact) => ({
            ...currentArtifact,
            plan: {
              ...currentArtifact.plan,
              status: "committed",
              committedPageId: artifact.plan.target.pageId!,
            },
          }));
          toast.success("已写入目标页面");
          return;
        }

        const result = await commitAgentArtifact(artifact);
        if (!result?.pageId) throw new Error("写入失败，请稍后再试");
        updateMessageArtifact(messageId, (currentArtifact) => ({
          ...currentArtifact,
          plan: {
            ...currentArtifact.plan,
            status: "committed",
            committedPageId: result.pageId,
          },
        }));
        toast.success("已写入目标页面");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "写入失败，请稍后再试";
        toast.error(message);
      } finally {
        setApplyingMessageId(null);
      }
    },
    [activeNotebookId, activePageId, editorRef, updateMessageArtifact],
  );

  const handleCancelWrite = useCallback(
    (messageId: string, artifact: MarkdownNoteArtifact) => {
      updateMessageArtifact(messageId, (currentArtifact) => ({
        ...currentArtifact,
        plan: {
          ...currentArtifact.plan,
          status: "cancelled",
        },
      }));
    },
    [activeNotebookId, updateMessageArtifact],
  );

  return {
    applyingMessageId,
    handleConfirmWrite,
    handleCancelWrite,
  };
}
