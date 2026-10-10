export type FsChange = { path: string; type: string };

export type WindowTabSnapshot = {
  id: string;
  pageId: string;
  type?: string;
  pinned?: boolean;
  workspaceId?: string;
};

export type WindowInitPayload = {
  takeTab?: WindowTabSnapshot;
  restoredTabs?: WindowTabSnapshot[];
};

export type AcceptTabPayload = {
  tab: WindowTabSnapshot;
  contentX: number;
};

export type TabDockPreviewPayload = {
  contentX: number | null;
};

export type FinishTabDragResult =
  | { action: "none" }
  | { action: "tearOff"; windowId: string }
  | { action: "docked"; windowId: string };
