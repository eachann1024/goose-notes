import { toast } from "@/components/ui/sonner";
import { usePages } from "@/stores/usePages";
import {
  isDiskContentMatchingSnapshot,
  updateSnapshotAfterWrite,
  updateSnapshotStat,
  deleteLocalMdSnapshot,
  type LocalMdFileStat,
} from "@/lib/local-md-snapshot";
import {
  confirmRecoveredLocalSave,
  discardPendingLocalSave,
} from "@/stores/pages/folderSync";
import { wasRecentlyInteracting } from "@/lib/editor-interaction-signal";

export interface Notebook {
  id: string;
  source?: string;
  localPath?: string;
}

export interface Page {
  localFilePath?: string;
}

export interface UseLocalFolderWatchOptions {
  notebook: Notebook | undefined;
  activePageId: string | null | undefined;
  page: Page | undefined;
}

export async function readDiskContent(
  filePath: string,
): Promise<string | null> {
  const fs = window.gooseFs;
  if (!fs) return null;
  try {
    if (fs.readFileStatAsync) {
      const r = await fs.readFileStatAsync(filePath);
      return r.ok ? (r.content ?? "") : null;
    }
    if (fs.readFileStat) {
      const r = fs.readFileStat(filePath);
      return r.ok ? (r.content ?? "") : null;
    }
    if (fs.readFileAsync) return (await fs.readFileAsync(filePath)) ?? null;
    if (fs.readFile) return fs.readFile(filePath) ?? null;
  } catch {
    // 读失败按「无从判断」处理，调用方跳过本次检查
  }
  return null;
}

export async function statDisk(
  filePath: string,
): Promise<LocalMdFileStat | null> {
  const fs = window.gooseFs;
  if (!fs?.statAsync) return null;
  try {
    return (await fs.statAsync(filePath)) ?? null;
  } catch {
    return null;
  }
}

export /**
 * 同一文件冲突 toast 去重：记录当前正在显示的冲突 toast id（key = filePath）。
 * toast 关闭后自动清除，确保同文件不叠弹。
 */
const activeConflictToasts = new Map<string, string | number>();

export function showConflictToast(
  filePath: string,
  pageId: string,
  onKeepMine: () => void,
  onLoadDisk: () => void,
) {
  // 去重：同文件已有 toast 则不重复弹
  if (activeConflictToasts.has(filePath)) return;

  const fileName = filePath.replace(/^.*[\\/]/, "");
  const toastId = toast.warning(`「${fileName}」已被外部修改`, {
    description: "选择如何处理冲突",
    duration: Infinity,
    action: {
      label: "保留我的编辑",
      onClick: (_e) => {
        activeConflictToasts.delete(filePath);
        onKeepMine();
      },
    },
    cancel: {
      label: "加载磁盘版本",
      onClick: (_e) => {
        activeConflictToasts.delete(filePath);
        onLoadDisk();
      },
    },
    onDismiss: () => {
      activeConflictToasts.delete(filePath);
    },
    onAutoClose: () => {
      activeConflictToasts.delete(filePath);
    },
  });

  activeConflictToasts.set(filePath, toastId);
}

export /** 冲突 toast 两个按钮的标准行为（watch change / pre-save / 新鲜度检查共用）。 */
function conflictHandlers(filePath: string, pageId: string) {
  return {
    // 保留我的编辑：以磁盘当前内容为已知基线（内存编辑仍 dirty），再 force
    // 落盘覆盖。禁止把快照写成 ""——空快照会让之后任何磁盘内容都判成外部修改。
    // 读盘失败则 deleteLocalMdSnapshot：无快照时 isLocalMdUnchanged 为 false
    //（不会跳过写盘），isDiskContentMatchingSnapshot 为 true（不误报冲突）。
    onKeepMine: () => {
      void (async () => {
        try {
          const diskContent = await readDiskContent(filePath);
          if (diskContent !== null) {
            updateSnapshotAfterWrite(filePath, diskContent);
            try {
              const stat = await statDisk(filePath);
              if (stat) updateSnapshotStat(filePath, stat);
            } catch {
              // 指纹失败不影响强制落盘
            }
          } else {
            deleteLocalMdSnapshot(filePath);
          }
        } catch {
          deleteLocalMdSnapshot(filePath);
        }
        const pg = usePages.getState().pages[pageId];
        if (!pg) return;
        void usePages
          .getState()
          .saveLocalPageContent(pageId, pg.content as any, { force: true })
          .then((saved) => {
            if (saved) confirmRecoveredLocalSave(pageId);
          })
          .catch((error) => {
            console.error("[local-folder] conflict force-save failed", error);
          });
      })();
    },
    // 加载磁盘版本：丢弃本地编辑，重读磁盘
    onLoadDisk: () => {
      discardPendingLocalSave(pageId);
      usePages.setState((s) => ({
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
      }));
      void usePages.getState().reloadLocalPageFromDisk(pageId);
    },
  };
}

export /**
 * 主动新鲜度检查：watch 不在场期间（Electron 窗口隐藏、查看其他笔记本、插件退出）
 * 的外部修改收不到 change 事件，在切页 / 窗口恢复可见时主动读盘 diff 兜底。
 * 没变 → 无操作；变了且页面干净且无近期交互 → 静默重载；变了且 dirty / 刚聚焦编辑器 → 冲突提示。
 */
async function checkLocalPageFreshness(pageId: string): Promise<void> {
  const page = usePages.getState().pages[pageId];
  const filePath = page?.localFilePath;
  if (!filePath) return;

  const diskContent = await readDiskContent(filePath);
  if (diskContent === null) return;
  if (isDiskContentMatchingSnapshot(filePath, diskContent)) return;

  const isDirty = Boolean(usePages.getState().dirtyLocalPageIds[pageId]);
  if (isDirty || wasRecentlyInteracting(2000)) {
    const { onKeepMine, onLoadDisk } = conflictHandlers(filePath, pageId);
    showConflictToast(filePath, pageId, onKeepMine, onLoadDisk);
    return;
  }
  void usePages.getState().reloadLocalPageFromDisk(pageId);
}
