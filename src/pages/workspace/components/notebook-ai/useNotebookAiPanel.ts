/**
 * AI 面板开关 + 打开方式（侧栏并排 / 独立标签）
 *
 * - 默认独立标签打开
 * - 侧栏模式：isOpen 控制右侧并排面板
 * - 标签模式：isOpen 表示应存在 notebook-ai 标签；激活/关闭由 tabs store 协同
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs, isNotebookAiTab } from "@/stores/useTabs";

const OPEN_STORAGE_KEY = "goose-note-ai-panel-open";
const LAYOUT_STORAGE_KEY = "goose-note-ai-layout-mode";

export type NotebookAiLayoutMode = "side-panel" | "tab";

export interface NotebookAiPanelSelectionCapture<TSelection = unknown> {
  version: 1;
  pageId: string;
  selection: TSelection;
}

/** 无记录或读失败时视为关闭（默认不打开 AI 面板）。 */
function readStoredOpen(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_STORAGE_KEY);
    return raw === "true";
  } catch {
    // localStorage 在隐私模式或受限 WebView 中可能不可用。
  }
  return false;
}

/** 默认独立标签打开。 */
function readStoredLayoutMode(): NotebookAiLayoutMode {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw === "side-panel" || raw === "tab") return raw;
  } catch {
    // ignore
  }
  return "tab";
}

function persistOpen(next: boolean) {
  try {
    localStorage.setItem(OPEN_STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
}

function persistLayoutMode(mode: NotebookAiLayoutMode) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function getActiveNotebookId(): string | null {
  return useNotebooks.getState().activeNotebookId;
}

export function useNotebookAiPanel() {
  const [isOpen, setIsOpen] = useState<boolean>(readStoredOpen);
  const [layoutMode, setLayoutModeState] =
    useState<NotebookAiLayoutMode>(readStoredLayoutMode);
  const [capturedSelection, setCapturedSelection] =
    useState<NotebookAiPanelSelectionCapture | null>(null);
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;

  const open = useCallback(
    (capture?: NotebookAiPanelSelectionCapture | null) => {
      setCapturedSelection(capture ?? null);
      setIsOpen(true);
      persistOpen(true);
      const notebookId = getActiveNotebookId();
      if (layoutModeRef.current === "tab" && notebookId) {
        useTabs.getState().openNotebookAiTab(notebookId);
      }
    },
    [],
  );

  const close = useCallback(() => {
    setCapturedSelection(null);
    setIsOpen(false);
    persistOpen(false);
    const notebookId = getActiveNotebookId();
    if (layoutModeRef.current === "tab" && notebookId) {
      useTabs.getState().closeNotebookAiTab(notebookId);
    }
  }, []);

  const toggle = useCallback(() => {
    setCapturedSelection(null);
    const notebookId = getActiveNotebookId();
    const tabs = useTabs.getState();

    if (layoutModeRef.current === "tab") {
      if (!notebookId) return;
      const aiTab = tabs.findNotebookAiTab(notebookId);
      const activeTab = tabs.openTabs.find((t) => t.id === tabs.activeTabId);

      // 已在 AI 标签 → 关闭
      if (aiTab && activeTab?.id === aiTab.id) {
        setIsOpen(false);
        persistOpen(false);
        tabs.closeNotebookAiTab(notebookId);
        return;
      }

      // 标签存在但未激活 → 激活；不存在 → 新建并激活
      setIsOpen(true);
      persistOpen(true);
      tabs.openNotebookAiTab(notebookId);
      return;
    }

    // 侧栏模式：简单开关
    setIsOpen((prev) => {
      const next = !prev;
      persistOpen(next);
      return next;
    });
  }, []);

  const setLayoutMode = useCallback(
    (mode: NotebookAiLayoutMode) => {
      if (mode === layoutModeRef.current) return;
      // 先更新 ref，避免 closeNotebookAiTab 触发的订阅把 isOpen 误写成 false
      layoutModeRef.current = mode;
      setLayoutModeState(mode);
      persistLayoutMode(mode);

      const notebookId = getActiveNotebookId();
      if (!isOpen || !notebookId) return;

      if (mode === "tab") {
        useTabs.getState().openNotebookAiTab(notebookId);
      } else {
        // 关闭 AI 标签，保持 isOpen 以显示侧栏
        useTabs.getState().closeNotebookAiTab(notebookId);
      }
    },
    [isOpen],
  );

  const consumeCapturedSelection = useCallback(() => {
    setCapturedSelection(null);
  }, []);

  // 标签模式：用户从标签栏关掉 AI 标签时，回写 isOpen=false
  useEffect(() => {
    const unsub = useTabs.subscribe((state, prev) => {
      if (layoutModeRef.current !== "tab") return;
      if (state.openTabs === prev.openTabs) return;
      const notebookId = getActiveNotebookId();
      if (!notebookId) return;
      const had = prev.openTabs.some(
        (t) => isNotebookAiTab(t) && t.workspaceId === notebookId,
      );
      const has = state.openTabs.some(
        (t) => isNotebookAiTab(t) && t.workspaceId === notebookId,
      );
      if (had && !has) {
        setIsOpen(false);
        persistOpen(false);
        setCapturedSelection(null);
      }
    });

    return unsub;
  }, []);

  // 启动恢复：标签模式且记录为打开 → 补齐 AI 标签
  useEffect(() => {
    if (layoutModeRef.current !== "tab" || !isOpen) return;
    const notebookId = getActiveNotebookId();
    if (!notebookId) return;
    const tabs = useTabs.getState();
    if (!tabs.findNotebookAiTab(notebookId)) {
      tabs.openNotebookAiTab(notebookId);
    }
    // 仅挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 笔记本切换：若当前正停在 AI 标签上，为新笔记本打开对应 AI 标签
  const activeNotebookId = useNotebooks((s) => s.activeNotebookId);
  useEffect(() => {
    if (!isOpen || !activeNotebookId) return;
    if (layoutModeRef.current !== "tab") return;
    const tabs = useTabs.getState();
    const activeTab = tabs.openTabs.find((t) => t.id === tabs.activeTabId);
    if (isNotebookAiTab(activeTab)) {
      tabs.openNotebookAiTab(activeNotebookId);
    }
  }, [activeNotebookId, isOpen]);

  return {
    isOpen,
    layoutMode,
    setLayoutMode,
    open,
    close,
    toggle,
    capturedSelection,
    consumeCapturedSelection,
  };
}
