import { restorePageWithToast } from "@/lib/page-delete-actions";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { toast } from "@/components/ui/sonner";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { useLocalFolderManualOrder } from "@/stores/localFolderOrder";
import { type SidebarContextMenuProps } from "./shared";

export function useSidebarContextMenu({
  page,
  children,
  onCreateLocalFile,
  onCreateLocalFolder,
}: SidebarContextMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const updatePage = usePages((s) => s.updatePage);

  const duplicatePage = usePages((s) => s.duplicatePage);

  const movePageTreeToNotebook = usePages((s) => s.movePageTreeToNotebook);

  const undoMovePageTree = usePages((s) => s.undoMovePageTree);

  const notebooks = useNotebooks((state) => state.notebooks);

  const notebook = notebooks[page.workspaceId];

  const isLocalFolder = notebook?.source === "local-folder";

  const isTrashed = !!page.trashedAt;

  // 只有进入手动顺序的目录才需要「恢复名称排序」（非目录页面恒为 false）
  const folderHasManualOrder = useLocalFolderManualOrder(
    page.workspaceId,
    page.isFolder ? page.id : undefined,
  );

  const movableNotebooks = Object.values(notebooks).filter(
    (item) => item.id !== page.workspaceId && item.source !== "local-folder",
  );

  const handleMoveToTopLevel = () => {
    updatePage(page.id, { parentId: undefined });
  };

  const handleDuplicatePage = async () => {
    const newId = await duplicatePage(page.id);
    if (!newId || newId === page.id) return;
    openPageFromSidebar(newId, "permanent");
  };

  const handleRestore = () => restorePageWithToast(page.id);

  const handleMoveToNotebook = (targetNotebookId: string) => {
    const result = movePageTreeToNotebook(page.id, targetNotebookId);
    if (!result.ok) {
      if (result.reason === "same-notebook") {
        toast.error("页面已在当前笔记本");
      } else if (result.reason === "target-not-supported") {
        toast.error("目标笔记本不支持移动");
      } else {
        toast.error("移动失败，请重试");
      }
      return;
    }

    const targetNotebook = notebooks[targetNotebookId];
    const targetName = targetNotebook?.name || "目标笔记本";
    toast.success(`已移动到「${targetName}」`, {
      description: `共移动 ${result.movedCount} 个页面`,
      duration: 5000,
      action: {
        label: "撤回",
        onClick: () => {
          const ok = undoMovePageTree(
            result.undoSnapshots,
            result.sourceNotebookId,
            result.prevActivePageId,
          );
          if (!ok) {
            toast.error("撤回失败：源笔记本不存在");
          }
        },
      },
    });
  };

  const localFolderFileManager = useSettings((s) => s.localFolderFileManager);

  const localFolderExternalEditor = useSettings(
    (s) => s.localFolderExternalEditor,
  );

  const localFolderTerminal = useSettings((s) => s.localFolderTerminal);

  const singleTabMode = effectiveSingleTabMode(
    useSettings((s) => s.singleTabMode),
  );

  const [renaming, setRenaming] = useState(false);

  const rowRef = useRef<HTMLDivElement>(null);

  const canRename =
    !isTrashed && !page.localPendingCreate && !page.localUnsaved;

  const hasParent = !!page.parentId;

  const createParentId = page.isFolder ? page.id : page.parentId;
  return {
    page,
    children,
    onCreateLocalFile,
    onCreateLocalFolder,
    menuOpen,
    setMenuOpen,
    updatePage,
    duplicatePage,
    movePageTreeToNotebook,
    undoMovePageTree,
    notebooks,
    notebook,
    isLocalFolder,
    isTrashed,
    folderHasManualOrder,
    movableNotebooks,
    handleMoveToTopLevel,
    handleDuplicatePage,
    handleRestore,
    handleMoveToNotebook,
    localFolderFileManager,
    localFolderExternalEditor,
    localFolderTerminal,
    singleTabMode,
    renaming,
    setRenaming,
    rowRef,
    canRename,
    hasParent,
    createParentId,
  };
}
