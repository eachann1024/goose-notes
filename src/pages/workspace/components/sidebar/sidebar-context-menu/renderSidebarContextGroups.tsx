import type { useSidebarContextMenu } from "./useSidebarContextMenu";
import { buildSidebarCreateGroups } from "./groups/buildSidebarCreateGroups";
import { appendSidebarOpenMoveGroups } from "./groups/appendSidebarOpenMoveGroups";
import { appendSidebarDeleteGroups } from "./groups/appendSidebarDeleteGroups";

export function renderSidebarContextGroups(
  argument: ReturnType<typeof useSidebarContextMenu>,
) {
  const sidebarCreateGroupsContext = buildSidebarCreateGroups(argument);
  const sidebarOpenMoveGroupsContext = appendSidebarOpenMoveGroups(
    sidebarCreateGroupsContext,
  );
  const sidebarDeleteGroupsContext = appendSidebarDeleteGroups(
    sidebarOpenMoveGroupsContext,
  );
  const context = sidebarDeleteGroupsContext;
  const { sections } = context;

  // 保留「新建 / 打开 / 整理」的语义标题；常规组用留白区分，避免
  // 本地目录里的每个动作组都再切一条线。危险操作仍单独成组。
  return sections.flatMap((section, index) =>
    index === sections.length - 1 && index > 0
      ? [<ContextMenuSeparator key="sep-danger" />, section]
      : [section],
  );
}
