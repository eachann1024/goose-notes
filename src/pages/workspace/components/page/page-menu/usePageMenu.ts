import { useSettings } from "@/stores/useSettings";
import { useEffect, useRef, useState } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportPageToImage, exportSelectionToImage } from "@/lib/imageExport";
import { extractBlockNoteTitle } from "@/components/editor/utils/blocknote-content";
import { getActiveGooseNoteEditor, getEditorSelectedBlocksForExport } from "@/components/editor/utils/selection";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { useTabs } from "@/stores/useTabs";

function captureEditorSelectedBlocks(): BlockNoteContent {
  return getEditorSelectedBlocksForExport(getActiveGooseNoteEditor());
}

export function usePageMenu() {
  const defaultLayout = useSettings(state => state.defaultPageLayout);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const {
    activePageId,
    getPage,
    updatePage,
    createPage,
    createLocalPageRecord,
    setActivePage,
  } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const page = activePageId ? getPage(activePageId) : undefined;
  const activeNotebook = activeNotebookId
    ? notebooks[activeNotebookId]
    : undefined;
  const isLocalFolderNotebook = activeNotebook?.source === "local-folder";
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const isLocalItem = Boolean(page?.localFilePath);
  const { openTabs, activeTabId } = useTabs();
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const canOpenInNewWindow = isElectronRuntime();

  const captureSelectedBlocks = () => {
    const blocks = captureEditorSelectedBlocks();
    selectedBlocksRef.current = blocks;
    setSelectedBlocks(blocks);
    return blocks;
  };

  useEffect(() => {
    const updateViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const handleImport = async () => {
    try {
      const result = await importFile({
        preserveStructure: isLocalFolderNotebook,
      });
      if (!result.success) {
        if (result.error !== "未选择文件") {
          toast.error(result.error || "导入失败");
        }
        return;
      }

      closeNotebookAiIfFullscreen();
      if (__HOST_TARGET__ === "electron" && !activeNotebookId) {
        toast.error("请先关联本地文件夹", {
          description: "导入前请先在左侧栏打开或新建一个本地文件夹作为存储位置。",
        });
        return;
      }

      if (isLocalFolderNotebook && activeNotebookId) {
        const pageId = await createLocalPageRecord({
          workspaceId: activeNotebookId,
          title: result.title,
          content: result.content as never,
        });
        if (!pageId) {
          toast.error("导入失败，请重试");
          return;
        }
        setActivePage(null);
        requestAnimationFrame(() => {
          setActivePage(pageId);
        });
        toast.success("已导入为新笔记");
        return;
      }

      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);
      if (!newId) return;

      const content = result.content;
      const blocks = [
        { type: "heading", props: { level: 1 }, content: result.title },
        ...content,
      ] as any[];

      updatePage(newId, { content: blocks });

      setActivePage(null);
      requestAnimationFrame(() => {
        setActivePage(newId);
      });
      toast.success("已导入为新笔记");
    } catch (error) {
      console.error("导入失败:", error);
      toast.error("导入失败，请检查文件后重试");
    }
  };

  const runExport = (label: string, task: () => Promise<unknown>) => {
    if (page?.isFolder) {
      toast.error("暂不支持整夹导出，请打开具体笔记后再执行导出");
      return;
    }
    const toastId = toast.loading(`正在导出 ${label}…`);
    void task()
      .then(() => toast.success(`${label} 已导出`, { id: toastId }))
      .catch((error) => {
        console.error(`[export] ${label} 失败:`, error);
        const message = error instanceof Error ? error.message : "";
        toast.error(
          message ? `${label} 导出失败：${message}` : `${label} 导出失败`,
          { id: toastId },
        );
      });
  };

  const handleThemeConfirm = (
    themeId: CardThemeId,
    watermarkConfig: WatermarkConfig,
  ) => {
    if (!page) return;
    const blocks = selectedBlocksRef.current;
    if (blocks.length > 0) {
      exportSelectionToImage(
        blocks,
        extractBlockNoteTitle(page.content) || "选中内容",
        themeId,
        watermarkConfig,
        page,
      );
    } else {
      exportPageToImage(page, themeId, watermarkConfig);
    }
  };

  return {
    page, activePageId, viewport,
    defaultLayout, themeSelectorOpen, setThemeSelectorOpen,
    pageMenuOpen, setPageMenuOpen, selectedBlocks,
    isLocalItem, activeTab, canOpenInNewWindow,
    captureSelectedBlocks, handleImport, runExport,
    handleThemeConfirm, updatePage,
  };
}
