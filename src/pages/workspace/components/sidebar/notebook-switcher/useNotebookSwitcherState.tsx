import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useSidebarView } from "@/stores/useSidebarView";
import { isElectronHost } from "@/lib/local-vault";
import { sortNotebooksByOrder, useNotebooks } from "@/stores/useNotebooks";

export function useNotebookSwitcherState({
  onOpenSettings,
  variant = "default",
}: {
  onOpenSettings?: () => void;
  variant?: "default" | "rail";
} = {}) {
  const toggleDarkMode = useSettings((s) => s.toggleDarkMode);

  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );

  const {
    notebooks,
    activeNotebookId,
    createNotebook,
    createLocalFolderNotebook,
    updateNotebook,
    deleteNotebook,
    reorderNotebooks,
  } = useNotebooks();

  const notebookDropdownHoverExpand = useSettings(
    (state) => state.notebookDropdownHoverExpand,
  );

  const [isOpen, setIsOpen] = useState(false);

  const isDraggingRef = useRef(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 整行按住再拖：短点选切换仓库，按住后才进入排序，避免再做拖拽把手
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      if (!isDraggingRef.current) setIsOpen(false);
    };
    window.addEventListener("blur", close);
    return () => window.removeEventListener("blur", close);
  }, [isOpen]);

  const [editDialog, setEditDialog] = useState({
    open: false,
    id: "",
    name: "",
    confirmName: "",
    icon: "",
    excludeFromGlobalSearch: false,
    openDeleteConfirm: false,
    isLocalFolder: false,
  });

  const [createDialog, setCreateDialog] = useState({
    open: false,
    name: "",
    icon: "BookOpen",
    error: "",
  });

  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;

  const isRail = variant === "rail";

  const notebookKind = isElectronHost ? "文件夹" : "笔记本";

  const activeNotebookLabel =
    activeNotebook?.name || (isElectronHost ? "打开文件夹" : "选择笔记本");

  const notebookList = sortNotebooksByOrder(notebooks);

  // Electron 仅本地文件夹模式：最后一个文件夹也允许移除（回到空态）
  const canDeleteNotebook = isElectronHost
    ? notebookList.length > 0
    : notebookList.length > 1;
  return {
    onOpenSettings,
    variant,
    toggleDarkMode,
    toggleSidebarCollapsed,
    notebooks,
    activeNotebookId,
    createNotebook,
    createLocalFolderNotebook,
    updateNotebook,
    deleteNotebook,
    reorderNotebooks,
    notebookDropdownHoverExpand,
    isOpen,
    setIsOpen,
    isDraggingRef,
    menuRef,
    sensors,
    editDialog,
    setEditDialog,
    createDialog,
    setCreateDialog,
    activeNotebook,
    isRail,
    notebookKind,
    activeNotebookLabel,
    notebookList,
    canDeleteNotebook,
  };
}
