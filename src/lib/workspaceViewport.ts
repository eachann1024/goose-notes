/**
 * 工作区窗口最小宽度与窄窗收栏。
 *
 * 最小宽度对齐 Chromium 主窗口内容区下限
 * `kMainBrowserContentsMinimumWidth = 500`。
 * 变窄时先收右侧 AI 并排栏，再收左侧栏，主区尽量保持 500px。
 * 自动收起不写入用户偏好；拉宽后按原偏好恢复。
 */

/** Chromium `kMainBrowserContentsMinimumWidth` */
export const WORKSPACE_MIN_WINDOW_WIDTH = 500;
export const WORKSPACE_MIN_WINDOW_HEIGHT = 560;

/** 主编辑区目标最小宽，与窗口下限一致 */
export const WORKSPACE_MIN_MAIN_WIDTH = WORKSPACE_MIN_WINDOW_WIDTH;

/**
 * 低于此宽度强制收起右侧 AI 并排栏。
 * 500 主区 + 默认左栏 180 + 默认 AI 栏 360 + 缝隙约 36。
 */
export const WORKSPACE_COLLAPSE_RIGHT_BELOW = 1100;

/**
 * 低于此宽度强制收起左侧栏。
 * 500 主区 + 默认左栏 180 + stage 垫约 28。
 */
export const WORKSPACE_COLLAPSE_LEFT_BELOW = 720;

export type WorkspaceViewportCollapse = {
  forceCollapseLeft: boolean;
  forceCollapseRight: boolean;
};

export function computeWorkspaceViewportCollapse(
  windowWidth: number,
): WorkspaceViewportCollapse {
  const width = Number.isFinite(windowWidth) ? windowWidth : 0;
  return {
    forceCollapseLeft: width < WORKSPACE_COLLAPSE_LEFT_BELOW,
    forceCollapseRight: width < WORKSPACE_COLLAPSE_RIGHT_BELOW,
  };
}

export function isEffectiveSidebarCollapsed(
  userCollapsed: boolean,
  forceCollapse: boolean,
  expandOverride: boolean,
): boolean {
  if (expandOverride) return false;
  return userCollapsed || forceCollapse;
}

export function isEffectiveRightSidePanelOpen(
  userOpen: boolean,
  forceCollapse: boolean,
  expandOverride: boolean,
): boolean {
  if (!userOpen) return false;
  if (expandOverride) return true;
  return !forceCollapse;
}
