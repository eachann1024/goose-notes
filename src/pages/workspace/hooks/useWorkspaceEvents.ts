import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import {
  OPEN_AI_WORKSPACE_EVENT,
  CLOSE_AI_WORKSPACE_EVENT,
} from "../components/ai/events";

interface UseWorkspaceEventsOptions {
  activePageId: string | null | undefined;
  page: unknown;
  setIsAiPageOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export function useWorkspaceEvents({
  activePageId,
  page,
  setIsAiPageOpen,
}: UseWorkspaceEventsOptions) {
  const { ai } = useSettings();
  const lastViewedPageIdRef = useRef<string | null>(null);

  // Open AI workspace event
  useEffect(() => {
    const handleOpenAiWorkspace = () => {
      if (!useSettings.getState().ai.enabled) {
        toast.error("请先在设置中启用 AI 助手");
        return;
      }

      if (!usePages.getState().activePageId) {
        toast("请先打开一个页面，再进入 AI 页面");
        return;
      }

      setIsAiPageOpen(true);
    };

    window.addEventListener(
      OPEN_AI_WORKSPACE_EVENT,
      handleOpenAiWorkspace as EventListener,
    );

    return () => {
      window.removeEventListener(
        OPEN_AI_WORKSPACE_EVENT,
        handleOpenAiWorkspace as EventListener,
      );
    };
  }, [setIsAiPageOpen]);

  // Close AI workspace event
  useEffect(() => {
    const handleCloseAiWorkspace = () => {
      setIsAiPageOpen(false);
    };
    window.addEventListener(CLOSE_AI_WORKSPACE_EVENT, handleCloseAiWorkspace);
    return () => {
      window.removeEventListener(CLOSE_AI_WORKSPACE_EVENT, handleCloseAiWorkspace);
    };
  }, [setIsAiPageOpen]);

  // Close AI page when switching pages
  useEffect(() => {
    if (!activePageId || !page) {
      setIsAiPageOpen(false);
      lastViewedPageIdRef.current = null;
      return;
    }

    if (lastViewedPageIdRef.current && lastViewedPageIdRef.current !== activePageId) {
      setIsAiPageOpen(false);
    }

    lastViewedPageIdRef.current = activePageId;
  }, [activePageId, page, setIsAiPageOpen]);

  // Close AI page when AI is disabled
  useEffect(() => {
    if (!ai.enabled) {
      setIsAiPageOpen(false);
    }
  }, [ai.enabled, setIsAiPageOpen]);
}
