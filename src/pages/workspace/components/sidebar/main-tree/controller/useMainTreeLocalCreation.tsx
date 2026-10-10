import { useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { PENDING_CREATE_ID_PREFIX, normalizePendingFileTitle } from "./shared";
import type { useMainTreeState } from "./useMainTreeState";

export function useMainTreeLocalCreation(
  input: ReturnType<typeof useMainTreeState>,
) {
  const {
    activeNotebookId,
    pages,
    createLocalFolderRecord,
    createLocalPageRecord,
    setExpandPageId,
    pendingCreate,
    setPendingCreate,
    setDraggingItemId,
    draggingItemIdRef,
    setPendingTreeSelection,
    isLocalFolder,
    expandedIds,
    expandView,
    setSelectedView,
    highlightedPageId,
  } = input;

  const startCreateLocalItem = useCallback(
    (kind: "folder" | "file", parentId?: string) => {
      if (!activeNotebookId || !isLocalFolder) return;
      const parentPage = parentId ? pages[parentId] : undefined;
      const safeParentId = parentPage?.isFolder ? parentId : undefined;
      const pendingId = `${PENDING_CREATE_ID_PREFIX}${kind}-${Date.now()}`;
      const now = Date.now();
      const defaultTitle = kind === "folder" ? "新建文件夹" : "未命名";
      setPendingCreate({
        id: pendingId,
        workspaceId: activeNotebookId,
        parentId: safeParentId,
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: defaultTitle }],
            },
          ],
        },
        isFolder: kind === "folder",
        localPendingCreate: kind,
        isLocked: false,
        fontSize: "default",
        fontFamily: "default",
        createdAt: now,
        updatedAt: now,
        order: now,
      });
      if (safeParentId && !expandedIds.includes(safeParentId)) {
        expandView(activeNotebookId, safeParentId);
      }
    },
    [activeNotebookId, expandedIds, expandView, isLocalFolder, pages],
  );

  const startCreateLocalFolder = useCallback(
    (parentId?: string) => startCreateLocalItem("folder", parentId),
    [startCreateLocalItem],
  );

  const startCreateLocalFile = useCallback(
    (parentId?: string) => startCreateLocalItem("file", parentId),
    [startCreateLocalItem],
  );

  const cancelPendingCreate = useCallback((id: string) => {
    setPendingCreate((current) => (current?.id === id ? null : current));
  }, []);

  const commitPendingCreate = useCallback(
    (id: string, name: string) => {
      const current = pendingCreate;
      if (!current || current.id !== id || !activeNotebookId) return;
      const kind = current.localPendingCreate === "file" ? "file" : "folder";
      void (async () => {
        if (kind === "folder") {
          const createdId = await createLocalFolderRecord({
            workspaceId: activeNotebookId,
            parentId: current.parentId,
            title: name,
          });
          if (!createdId) {
            setPendingCreate((latest) => (latest?.id === id ? null : latest));
            toast.error("新建文件夹失败：名称已存在或无写入权限");
            return;
          }
          setPendingCreate((latest) => (latest?.id === id ? null : latest));
          if (current.parentId) {
            expandView(activeNotebookId, current.parentId);
          }
          setExpandPageId(createdId);
          toast.success("已新建文件夹");
          return;
        }

        const createdId = await createLocalPageRecord({
          workspaceId: activeNotebookId,
          parentId: current.parentId,
          title: normalizePendingFileTitle(name) || "未命名",
        });
        if (!createdId) {
          setPendingCreate((latest) => (latest?.id === id ? null : latest));
          toast.error("新建文件失败：名称已存在或无写入权限");
          return;
        }
        setPendingCreate((latest) => (latest?.id === id ? null : latest));
        if (current.parentId) {
          expandView(activeNotebookId, current.parentId);
        }
        usePages.getState().setActivePage(createdId);
        setExpandPageId(createdId);
        openPageFromSidebar(createdId, "preview");
      })();
    },
    [
      activeNotebookId,
      createLocalFolderRecord,
      createLocalPageRecord,
      expandView,
      pendingCreate,
      setExpandPageId,
    ],
  );

  const handleItemDragStart = useCallback(
    (id: string) => {
      draggingItemIdRef.current = id;
      setDraggingItemId(id);
      if (!activeNotebookId) return;
      setSelectedView(activeNotebookId, id);
      setPendingTreeSelection({
        notebookId: activeNotebookId,
        pageId: id,
        previousHighlightedPageId: highlightedPageId ?? null,
      });
    },
    [activeNotebookId, highlightedPageId, setSelectedView],
  );

  const handleItemDragEnd = useCallback(() => {
    draggingItemIdRef.current = null;
    setDraggingItemId(null);
  }, []);
  return {
    ...input,
    startCreateLocalItem,
    startCreateLocalFolder,
    startCreateLocalFile,
    cancelPendingCreate,
    commitPendingCreate,
    handleItemDragStart,
    handleItemDragEnd,
  };
}
