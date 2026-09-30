import { useEffect, useRef } from "react";
import { useSearchSession } from "./useSearchSession";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { tryShowPageInFocusedSplit } from "@/lib/editor-split/commands";
import { closeNotebookAiIfFullscreen } from "../notebook-ai/useNotebookAiPanel";
import { useCommandSearchIndexWarmup } from "../command/useCommandSearchIndexWarmup";

export function SearchSessionController() {
  useCommandSearchIndexWarmup();
  const nonce = useSearchSession(s => s.requestNonce);
  const handled = useRef(0);
  useEffect(() => {
    if (!nonce || nonce === handled.current) return;
    handled.current = nonce;
    const session = useSearchSession.getState();
    if (!session.targetPageId || !usePages.getState().pages[session.targetPageId]) return;
    closeNotebookAiIfFullscreen();
    if (!tryShowPageInFocusedSplit(session.targetPageId)) useTabs.getState().openPreviewTab(session.targetPageId);
    usePages.getState().setExpandPageId(session.targetPageId);
  }, [nonce]);
  return null;
}
