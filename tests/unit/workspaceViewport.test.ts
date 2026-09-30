import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  computeWorkspaceViewportCollapse,
  isEffectiveRightSidePanelOpen,
  isEffectiveSidebarCollapsed,
  WORKSPACE_COLLAPSE_LEFT_BELOW,
  WORKSPACE_COLLAPSE_RIGHT_BELOW,
  WORKSPACE_MIN_WINDOW_HEIGHT,
  WORKSPACE_MIN_WINDOW_WIDTH,
} from "../../src/lib/workspaceViewport";
import { useSidebarView } from "../../src/stores/useSidebarView";
import { useWorkspaceViewport } from "../../src/stores/useWorkspaceViewport";

function resetViewportStores() {
  useWorkspaceViewport.setState({
    forceCollapseLeft: false,
    forceCollapseRight: false,
    leftExpandOverride: false,
    rightExpandOverride: false,
  });
  useSidebarView.setState({ sidebarCollapsed: false });
}

test("最小宽度对齐 Chromium 主窗口内容区 500", () => {
  expect(WORKSPACE_MIN_WINDOW_WIDTH).toBe(500);
  expect(WORKSPACE_MIN_WINDOW_HEIGHT).toBe(560);
  expect(WORKSPACE_COLLAPSE_RIGHT_BELOW).toBeGreaterThan(
    WORKSPACE_COLLAPSE_LEFT_BELOW,
  );
  expect(WORKSPACE_COLLAPSE_LEFT_BELOW).toBeGreaterThan(
    WORKSPACE_MIN_WINDOW_WIDTH,
  );
});

test("变窄先收右栏再收左栏，拉宽按阈值恢复", () => {
  expect(computeWorkspaceViewportCollapse(1250)).toEqual({
    forceCollapseLeft: false,
    forceCollapseRight: false,
  });
  expect(computeWorkspaceViewportCollapse(900)).toEqual({
    forceCollapseLeft: false,
    forceCollapseRight: true,
  });
  expect(computeWorkspaceViewportCollapse(500)).toEqual({
    forceCollapseLeft: true,
    forceCollapseRight: true,
  });
  expect(
    computeWorkspaceViewportCollapse(WORKSPACE_COLLAPSE_RIGHT_BELOW),
  ).toEqual({
    forceCollapseLeft: false,
    forceCollapseRight: false,
  });
  expect(
    computeWorkspaceViewportCollapse(WORKSPACE_COLLAPSE_LEFT_BELOW),
  ).toEqual({
    forceCollapseLeft: false,
    forceCollapseRight: true,
  });
});

test("自动收起不改用户偏好，覆盖只在强制收起时显示", () => {
  expect(isEffectiveSidebarCollapsed(false, false, false)).toBe(false);
  expect(isEffectiveSidebarCollapsed(false, true, false)).toBe(true);
  expect(isEffectiveSidebarCollapsed(false, true, true)).toBe(false);
  expect(isEffectiveSidebarCollapsed(true, true, false)).toBe(true);
  expect(isEffectiveSidebarCollapsed(true, true, true)).toBe(false);
  expect(isEffectiveSidebarCollapsed(true, false, false)).toBe(true);

  expect(isEffectiveRightSidePanelOpen(true, false, false)).toBe(true);
  expect(isEffectiveRightSidePanelOpen(true, true, false)).toBe(false);
  expect(isEffectiveRightSidePanelOpen(true, true, true)).toBe(true);
  expect(isEffectiveRightSidePanelOpen(false, true, false)).toBe(false);
  expect(isEffectiveRightSidePanelOpen(false, true, true)).toBe(false);
});

test("窄窗点开侧栏只加覆盖，不把收起偏好写成展开", () => {
  resetViewportStores();
  useWorkspaceViewport.setState({
    forceCollapseLeft: true,
    forceCollapseRight: false,
    leftExpandOverride: false,
    rightExpandOverride: false,
  });
  useSidebarView.setState({ sidebarCollapsed: true });

  useSidebarView.getState().toggleSidebarCollapsed();
  expect(useSidebarView.getState().sidebarCollapsed).toBe(true);
  expect(useWorkspaceViewport.getState().leftExpandOverride).toBe(true);

  useSidebarView.getState().toggleSidebarCollapsed();
  expect(useSidebarView.getState().sidebarCollapsed).toBe(true);
  expect(useWorkspaceViewport.getState().leftExpandOverride).toBe(false);

  useWorkspaceViewport.setState({
    forceCollapseLeft: false,
    leftExpandOverride: false,
  });
  useSidebarView.getState().toggleSidebarCollapsed();
  expect(useSidebarView.getState().sidebarCollapsed).toBe(false);
  resetViewportStores();
});

test("主进程窗口最小宽使用共享常量，不再写死 800", () => {
  const windows = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  const layout = readFileSync(
    new URL("../../electron/main/windowLayout.ts", import.meta.url),
    "utf8",
  );
  expect(windows).toContain("minWidth: MIN_WORKSPACE_WIDTH");
  expect(windows).toContain("minHeight: MIN_WORKSPACE_HEIGHT");
  expect(windows).not.toContain("minWidth: 800");
  expect(layout).toContain("WORKSPACE_MIN_WINDOW_WIDTH");
});
