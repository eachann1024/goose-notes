import { useEffect, useMemo, useRef } from "react";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { buildAiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";
import { getCurrentNotebookAiPageId } from "@/lib/notebook-ai/context";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { FOCUS_AI_COMPOSER_EVENT } from "@/components/editor/ai/composer/selectionQuote";
import {
  buildComposerDraftFromReference,
  resolveEmptySessionComposerSeed,
  shouldSeedCurrentPageReference,
} from "../defaultComposerReference";
import type { NotebookAiSessionValue } from "../NotebookAiSession";
import type { PanelSurfaceState } from "./usePanelSurface";
export function usePanelComposerSeed(
  notebookId: string,
  session: NotebookAiSessionValue,
  surface: PanelSurfaceState,
) {
  const {
    ensureFreshConversation,
    messages,
    suppressDefaultPageSeed,
    composerRevision,
    unavailableReason,
  } = session;
  const { bodyReady, composerRef } = surface;
  // 只订当前活动页是否属于本笔记本（字符串），任意页自动保存不会重渲染面板。
  const fallbackPageId = usePages((state) => {
    const activeId = state.activePageId;
    if (activeId && state.pages[activeId]?.workspaceId === notebookId) {
      return activeId;
    }
    return null;
  });
  const notebooks = useNotebooks((state) => state.notebooks);

  const ensureFreshOnOpenRef = useRef(ensureFreshConversation);
  ensureFreshOnOpenRef.current = ensureFreshConversation;
  useEffect(() => {
    ensureFreshOnOpenRef.current();
  }, []);

  // 空会话默认 @ 跟随当前页：切笔记本 / 切页后再打开面板时换成最新笔记。
  // 用户已打字、加过其他 chip，或会话里已有消息，都保持原样。
  const currentPageId =
    getCurrentNotebookAiPageId(notebookId) ?? fallbackPageId;
  const initialReference = useMemo(() => {
    const page = currentPageId
      ? usePages.getState().pages[currentPageId]
      : undefined;
    return page ? buildAiFileReferenceAttrs(page, notebooks) : null;
  }, [currentPageId, notebooks]);
  const composerSeedContent = useMemo(
    () =>
      resolveEmptySessionComposerSeed(
        messages.length,
        useNotebookAiChats.getState().getComposerDraft(notebookId),
        initialReference,
        { suppress: suppressDefaultPageSeed },
      ),
    [
      initialReference,
      messages.length,
      notebookId,
      composerRevision,
      suppressDefaultPageSeed,
    ],
  );

  // Composer 挂载（或 key 重挂载）后：空会话且输入区仍是默认 @ 时跟到当前页。
  // /new 后 suppress：空输入 replaceable，不走这里，否则会把刚清掉的 tag 种回去。
  useEffect(() => {
    if (!bodyReady || !initialReference) return;
    const draft = useNotebookAiChats.getState().getComposerDraft(notebookId);
    if (
      !shouldSeedCurrentPageReference(messages.length, draft, currentPageId, {
        suppress: suppressDefaultPageSeed,
      })
    ) {
      return;
    }
    const timer = setTimeout(() => {
      const result =
        composerRef.current?.replaceDefaultPageReference(initialReference);
      if (result === "skipped") return;
      useNotebookAiChats
        .getState()
        .setComposerDraft(
          notebookId,
          buildComposerDraftFromReference(initialReference),
        );
    }, 0);
    return () => clearTimeout(timer);
  }, [
    bodyReady,
    currentPageId,
    initialReference,
    messages.length,
    composerRevision,
    notebookId,
    suppressDefaultPageSeed,
  ]);

  // 面板打开即聚焦输入框；/new 重挂 Composer 后同样拉回焦点。
  // 已打开时重复触发「打开」走 goose-note:focus-ai-composer
  useEffect(() => {
    if (unavailableReason || !bodyReady) return;
    const focusComposer = () => {
      // Explicit AI activation can close settings in the same event turn.
      window.requestAnimationFrame(() => {
        if (!isWorkspaceSettingsOpen()) composerRef.current?.focus();
      });
    };
    const timer = window.setTimeout(focusComposer, 50);
    window.addEventListener(FOCUS_AI_COMPOSER_EVENT, focusComposer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(FOCUS_AI_COMPOSER_EVENT, focusComposer);
    };
  }, [unavailableReason, bodyReady, composerRevision]);

  return { initialReference, composerSeedContent };
}
