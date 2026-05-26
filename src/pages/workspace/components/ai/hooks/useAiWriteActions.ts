import { useCallback, useState, type RefObject } from "react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { commitAgentArtifact } from "@/agent/core/runtime";
import type { EditorRef } from "../../editor/Editor";
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
      trackEvent("agent_commit_confirmed", {
        feature: "agent_runtime",
        capability_id: "note.commit",
        artifact_type: artifact.type,
        target_type: artifact.plan.target.mode,
      });
      trackEvent("ai_write_confirmed", {
        feature: "ai_write",
        action: "confirm",
        write_action: artifact.plan.action,
        target_type: artifact.plan.target.mode,
        is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
        cross_notebook: Boolean(
          artifact.plan.target.workspaceId &&
            activeNotebookId &&
            artifact.plan.target.workspaceId !== activeNotebookId,
        ),
      });

      try {
        const editor = editorRef?.current?.editor;
        const canUseEditor =
          editor &&
          (artifact.plan.action === "replace_page" || artifact.plan.action === "append_page") &&
          artifact.plan.target.pageId === activePageId &&
          artifact.plan.outputMarkdown;

        if (canUseEditor) {
          const newBlocks = await editor.tryParseMarkdownToBlocks(artifact.plan.outputMarkdown);

          if (artifact.plan.action === "replace_page") {
            const allBlocks = editor.document;
            const titleBlock = allBlocks[0];
            const blocksToRemove = allBlocks.slice(1);
            const contentBlocks =
              newBlocks[0]?.type === "heading" && (newBlocks[0] as any)?.props?.level === 1
                ? newBlocks.slice(1)
                : newBlocks;
            if (blocksToRemove.length) editor.removeBlocks(blocksToRemove);
            if (contentBlocks.length && titleBlock) {
              editor.insertBlocks(contentBlocks, titleBlock, "after");
            }
          } else {
            const allBlocks = editor.document;
            const lastBlock = allBlocks[allBlocks.length - 1];
            if (lastBlock) editor.insertBlocks(newBlocks, lastBlock, "after");
          }

          updateMessageArtifact(messageId, (currentArtifact) => ({
            ...currentArtifact,
            plan: {
              ...currentArtifact.plan,
              status: "committed",
              committedPageId: artifact.plan.target.pageId!,
            },
          }));
          trackEvent("agent_commit_succeeded", {
            feature: "agent_runtime",
            capability_id: "note.commit",
            artifact_type: artifact.type,
            target_type: artifact.plan.target.mode,
          });
          trackEvent("ai_write_committed", {
            feature: "ai_write",
            action: "commit",
            result: "success",
            write_action: artifact.plan.action,
            target_type: artifact.plan.target.mode,
            is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
            cross_notebook: false,
          });
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
        trackEvent("agent_commit_succeeded", {
          feature: "agent_runtime",
          capability_id: "note.commit",
          artifact_type: artifact.type,
          target_type: artifact.plan.target.mode,
        });
        trackEvent("ai_write_committed", {
          feature: "ai_write",
          action: "commit",
          result: "success",
          write_action: artifact.plan.action,
          target_type: artifact.plan.target.mode,
          is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
          cross_notebook: Boolean(
            artifact.plan.target.workspaceId &&
              activeNotebookId &&
              artifact.plan.target.workspaceId !== activeNotebookId,
          ),
        });
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
      trackEvent("agent_commit_cancelled", {
        feature: "agent_runtime",
        capability_id: "note.commit",
        artifact_type: artifact.type,
        target_type: artifact.plan.target.mode,
      });
      trackEvent("ai_write_cancelled", {
        feature: "ai_write",
        action: "cancel",
        write_action: artifact.plan.action,
        target_type: artifact.plan.target.mode,
        is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
        cross_notebook: Boolean(
          artifact.plan.target.workspaceId &&
            activeNotebookId &&
            artifact.plan.target.workspaceId !== activeNotebookId,
        ),
      });
    },
    [activeNotebookId, updateMessageArtifact],
  );

  return {
    applyingMessageId,
    handleConfirmWrite,
    handleCancelWrite,
  };
}
