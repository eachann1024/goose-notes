import type { GitSyncBridge } from "../../src/lib/git-sync-contract";
import type {
  AssetMaintenanceBridge,
  AssetWorkspaceSnapshot,
} from "../../src/lib/asset-maintenance-contract";
import { ipcRenderer } from "electron";

export const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args);

export const assetMaintenance: AssetMaintenanceBridge = {
  open: () => invoke("asset-maintenance:open"),
  appearance: () => invoke("asset-maintenance:appearance"),
  notebooks: () => invoke("asset-maintenance:notebooks"),
  scan: (notebookId) => invoke("asset-maintenance:scan", notebookId),
  trash: (token, paths) => invoke("asset-maintenance:trash", token, paths),
  onSnapshotRequest: (callback) => {
    const listener = (_event: unknown, requestId: string) =>
      callback(requestId);
    ipcRenderer.on("asset-maintenance:snapshot-request", listener);
    return () =>
      ipcRenderer.removeListener(
        "asset-maintenance:snapshot-request",
        listener,
      );
  },
  replySnapshot: (requestId: string, snapshot: AssetWorkspaceSnapshot | null) =>
    ipcRenderer.send("asset-maintenance:snapshot-reply", requestId, snapshot),
};

export const gitSync: GitSyncBridge = {
  getState: () => invoke("git-sync:state"),
  checkFolder: (localPath) => invoke("git-sync:check-folder", localPath),
  save: (config) => invoke("git-sync:save", config),
  checkVisibility: (request) => invoke("git-sync:visibility", request),
  remove: (notebookId) => invoke("git-sync:remove", notebookId),
  syncNow: (notebookId) => invoke("git-sync:now", notebookId),
  onState: (callback) => {
    const listener = (_event: unknown, state: Parameters<typeof callback>[0]) =>
      callback(state);
    ipcRenderer.on("git-sync:state", listener);
    return () => ipcRenderer.removeListener("git-sync:state", listener);
  },
  onPrepare: (callback) => {
    const listener = (
      _event: unknown,
      requestId: string,
      localPaths: string[],
    ) => callback(requestId, localPaths);
    ipcRenderer.on("git-sync:prepare", listener);
    return () => ipcRenderer.removeListener("git-sync:prepare", listener);
  },
  replyPrepare: (requestId, error) =>
    ipcRenderer.send("git-sync:prepare-reply", requestId, error),
  onFinish: (callback) => {
    const listener = (_event: unknown, requestId: string) =>
      callback(requestId);
    ipcRenderer.on("git-sync:finish", listener);
    return () => ipcRenderer.removeListener("git-sync:finish", listener);
  },
};
