/**
 * useTreeRename.ts
 * 侧边树节点 inline 重命名 hook（预留结构）。
 * 当前重命名入口在 SidebarContextMenu 中，未来如需支持双击 inline 编辑可在此实现。
 */

export interface UseTreeRenameReturn {
  renamingId: string | null;
  startRename: (id: string) => void;
  commitRename: (id: string, newTitle: string) => void;
  cancelRename: () => void;
}

export function useTreeRename(): UseTreeRenameReturn {
  // 预留：未来在此实现 inline 重命名状态管理
  return {
    renamingId: null,
    startRename: () => {},
    commitRename: () => {},
    cancelRename: () => {},
  };
}
