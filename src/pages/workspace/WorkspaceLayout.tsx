import { renderWorkspaceShell } from "./layout/renderWorkspaceShell";
import { type WorkspaceLayoutProps } from "./layout/shared";
import { useWorkspaceLayoutState } from "./layout/useWorkspaceLayoutState";
import { useWorkspaceSettingsNavigation } from "./layout/useWorkspaceSettingsNavigation";
import { useWorkspaceAiNavigation } from "./layout/useWorkspaceAiNavigation";
import { useWorkspaceScrollSync } from "./layout/useWorkspaceScrollSync";

export function WorkspaceLayout(props: WorkspaceLayoutProps) {
  const layout = useWorkspaceLayoutState(props);
  const settings = useWorkspaceSettingsNavigation(layout);
  const ai = useWorkspaceAiNavigation(settings);
  const workspaceScrollSyncContext = useWorkspaceScrollSync(ai);
  const context = workspaceScrollSyncContext;

  return renderWorkspaceShell(context);
}
