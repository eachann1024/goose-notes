export {
  MAIN_WIDTH,
  MAIN_HEIGHT,
  QUICKNOTE_WIDTH,
  QUICKNOTE_HEIGHT,
  TITLE_BAR_HEIGHT,
  type CreateWorkspaceWindowOpts,
  setMainWindowTitleBarHeight,
} from "./windows/configuration";
export {
  onBrowserWindowCreated,
  markQuicknoteActivateSuppressed,
  shouldSuppressWorkspaceActivate,
  hasVisibleWindow,
  onWindowVisibilityChange,
} from "./windows/visibility";
export { persistWindowLayout } from "./windows/layout";
export {
  createWorkspaceWindow,
  createMainWindow,
  restoreWorkspaceWindows,
} from "./windows/workspace";
export {
  getAssetMaintenanceWindow,
  createAssetMaintenanceWindow,
} from "./windows/maintenance";
export { createQuicknoteWindow } from "./windows/quicknote";
export {
  markQuitting,
  lookupWindowContext,
  currentTitleBarHeight,
  type WorkspaceDockSurface,
  listWorkspaceDockSurfaces,
  sendToWorkspace,
  workspaceOuterBounds,
  closeWorkspaceWindow,
  getMainWindow,
  getQuicknoteWindow,
  broadcast,
} from "./windows/registry";
export {
  toggleWindow,
  toggleQuicknoteWindow,
  closeQuicknote,
  showAndFocusMainWindow,
  showOrCreateMainWindow,
} from "./windows/activation";
export { requestCloseActiveTab } from "./windows/close";
