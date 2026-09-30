import { assertGitSyncWritable } from "./gitSyncLock";
import { BrowserWindow, dialog, ipcMain, net, shell } from "electron";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AssetNotebook, AssetScan, AssetWorkspaceSnapshot } from "../../src/lib/asset-maintenance-contract";
import { scanUnreferencedLocalAssets } from "../../src/lib/local-folder-asset-maintenance";
import { assertAllowed } from "./allowlist";
import { assetFingerprint, assertNotebookPath, isInsideNotebook, notebookScanFs } from "./assetMaintenanceFiles";
import { createAssetMaintenanceWindow, getAssetMaintenanceWindow, lookupWindowContext } from "./windows";

type ScanRecord = { result: AssetScan; root: string; fingerprints: Map<string, string>; created: number };
let scanRecord: ScanRecord | null = null;
let busy = false;
const requests = new Map<string, { senderId: number; resolve: (snapshot: AssetWorkspaceSnapshot) => void; reject: (error: Error) => void }>();

function workspaces() {
  return BrowserWindow.getAllWindows().filter((win) => lookupWindowContext(win)?.kind === "workspace");
}

async function workspaceSnapshots(): Promise<AssetWorkspaceSnapshot[]> {
  const windows = workspaces();
  if (!windows.length) throw new Error("请保持笔记工作区打开后再清理");
  return Promise.all(windows.map((win) => new Promise<AssetWorkspaceSnapshot>((resolve, reject) => {
    const requestId = randomUUID();
    const timer = setTimeout(() => finish(new Error("工作区未响应，已停止清理。请等待全部窗口加载完成后重试。")), 15000);
    const finish = (error?: Error, snapshot?: AssetWorkspaceSnapshot) => {
      clearTimeout(timer);
      requests.delete(requestId);
      if (error) reject(error); else resolve(snapshot!);
    };
    requests.set(requestId, { senderId: win.webContents.id, resolve: (snapshot) => finish(undefined, snapshot), reject: (error) => finish(error) });
    win.webContents.send("asset-maintenance:snapshot-request", requestId);
  })));
}

function notebooksFrom(snapshots: AssetWorkspaceSnapshot[]): AssetNotebook[] {
  const byId = new Map<string, AssetNotebook>();
  for (const snapshot of snapshots) for (const notebook of snapshot.notebooks) {
    const previous = byId.get(notebook.id);
    if (previous && previous.localPath !== notebook.localPath) throw new Error("笔记本路径在窗口间不一致，请重新打开工作区");
    byId.set(notebook.id, notebook);
  }
  return [...byId.values()];
}

function pagesForNotebook(snapshots: AssetWorkspaceSnapshot[], notebook: AssetNotebook, root: string) {
  const configuredRoot = path.resolve(notebook.localPath);
  return snapshots.flatMap((snapshot) => snapshot.pages).flatMap((page) => {
    if (!page.localFilePath) return [];
    const filePath = path.resolve(page.localFilePath);
    if (isInsideNotebook(root, filePath)) return [{ ...page, localFilePath: filePath }];
    if (!isInsideNotebook(configuredRoot, filePath)) return [];
    return [{ ...page, localFilePath: path.join(root, path.relative(configuredRoot, filePath)) }];
  });
}

function assertMaintenanceSender(event: Electron.IpcMainInvokeEvent) {
  if (event.sender !== getAssetMaintenanceWindow()?.webContents || event.senderFrame !== event.sender.mainFrame) {
    throw new Error("仅资源清理窗口可执行此操作");
  }
}

async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  if (busy) throw new Error("资源清理正在执行，请稍候");
  busy = true;
  try { return await operation(); } finally { busy = false; }
}

export function registerAssetMaintenanceIpc(): void {
  ipcMain.on("asset-maintenance:snapshot-reply", (event, requestId: string, snapshot: AssetWorkspaceSnapshot | null) => {
    const request = requests.get(requestId);
    if (!request || request.senderId !== event.sender.id || event.senderFrame !== event.sender.mainFrame) return;
    if (!snapshot || !Array.isArray(snapshot.pages) || !Array.isArray(snapshot.notebooks)) request.reject(new Error("无法读取工作区编辑内容，已停止清理"));
    else request.resolve(snapshot);
  });
  ipcMain.handle("asset-maintenance:open", (event) => {
    if (lookupWindowContext(BrowserWindow.fromWebContents(event.sender))?.kind !== "workspace") throw new Error("请从工作区设置打开");
    const existing = getAssetMaintenanceWindow();
    const win = createAssetMaintenanceWindow();
    if (existing) return;
    scanRecord = null;
    // 专用 session + 不透明扫描令牌：预览协议没有任意路径读取入口。
    const previewSession = win.webContents.session;
    previewSession.protocol.handle("goose-asset", async (request) => {
      const url = new URL(request.url);
      const record = scanRecord;
      const indexText = url.pathname.slice(1);
      const asset = /^\d+$/.test(indexText) ? record?.result.assets[Number(indexText)] : undefined;
      if (!record || url.hostname !== record.result.token || !asset || Date.now() - record.created > 10 * 60_000) return new Response(null, { status: 404 });
      try {
        await assertNotebookPath(record.root, asset.path);
        return await net.fetch(pathToFileURL(asset.path).href, { headers: request.headers });
      } catch { return new Response(null, { status: 404 }); }
    });
    win.once("closed", () => {
      scanRecord = null;
      previewSession.protocol.unhandle("goose-asset");
    });
  });
  ipcMain.handle("asset-maintenance:appearance", async (event) => {
    assertMaintenanceSender(event);
    return (await workspaceSnapshots())[0].appearance;
  });
  ipcMain.handle("asset-maintenance:notebooks", async (event) => {
    assertMaintenanceSender(event);
    return notebooksFrom(await workspaceSnapshots());
  });
  ipcMain.handle("asset-maintenance:scan", async (event, notebookId: string) => {
    assertMaintenanceSender(event);
    return exclusive(async () => {
      scanRecord = null;
      const snapshots = await workspaceSnapshots();
      const notebook = notebooksFrom(snapshots).find((item) => item.id === notebookId);
      if (!notebook) throw new Error("请先选择本地文件夹笔记本");
      const root = await realpath(assertAllowed(notebook.localPath));
      assertAllowed(root);
      const assets = await scanUnreferencedLocalAssets({ basePath: root, pages: pagesForNotebook(snapshots, notebook, root), gooseFs: notebookScanFs(root) });
      const fingerprints = new Map<string, string>();
      for (const asset of assets) fingerprints.set(asset.path, await assetFingerprint(root, asset.path));
      const token = randomUUID();
      const result: AssetScan = { token, notebook, assets: assets.map((asset, index) => ({ ...asset, previewUrl: `goose-asset://${token}/${index}` })) };
      if (event.sender.isDestroyed()) throw new Error("资源清理窗口已关闭");
      scanRecord = { result, root, fingerprints, created: Date.now() };
      return result;
    });
  });
  ipcMain.handle("asset-maintenance:trash", async (event, token: string, paths: string[]) => {
    assertMaintenanceSender(event);
    return exclusive(async () => {
      const record = scanRecord;
      if (!record || record.result.token !== token || Date.now() - record.created > 10 * 60_000) throw new Error("扫描结果已过期，请重新扫描");
      if (!Array.isArray(paths) || !paths.length || paths.some((p) => !record.fingerprints.has(p))) throw new Error("只能删除本次扫描中的图片和视频");
      const selected = [...new Set(paths)];
      const confirmation = await dialog.showMessageBox(getAssetMaintenanceWindow()!, {
        type: "warning", title: "移入系统废纸篓", message: `将 ${selected.length} 个图片或视频移入系统废纸篓？`,
        detail: "确认后会重新读取 Markdown 和所有工作区的当前编辑内容。结果发生变化时会停止删除。", buttons: ["取消", "移入废纸篓"], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (confirmation.response !== 1) return { deleted: 0, canceled: true };
      // 一次性令牌；任何失败、部分完成或再次点击均须重新扫描。
      scanRecord = null;
      if (event.sender.isDestroyed()) throw new Error("资源清理窗口已关闭");
      if (Date.now() - record.created > 10 * 60_000) throw new Error("扫描结果已过期，请重新扫描");
      const snapshots = await workspaceSnapshots();
      const notebook = notebooksFrom(snapshots).find((item) => item.id === record.result.notebook.id);
      if (!notebook || await realpath(assertAllowed(notebook.localPath)) !== record.root) throw new Error("笔记本已变更，请重新扫描");
      const latest = await scanUnreferencedLocalAssets({ basePath: record.root, pages: pagesForNotebook(snapshots, notebook, record.root), gooseFs: notebookScanFs(record.root) });
      const unreferenced = new Set(latest.map((asset) => asset.path));
      for (const filePath of selected) {
        if (!unreferenced.has(filePath) || await assetFingerprint(record.root, filePath) !== record.fingerprints.get(filePath)) throw new Error("资源引用或文件已变化，未删除，请重新扫描");
      }
      let deleted = 0;
      try {
        for (const filePath of selected) {
          if (event.sender.isDestroyed()) throw new Error("资源清理窗口已关闭");
          await assertNotebookPath(record.root, filePath);
          if (await assetFingerprint(record.root, filePath) !== record.fingerprints.get(filePath)) throw new Error("资源文件已变化");
          assertGitSyncWritable(filePath);
          await shell.trashItem(filePath);
          deleted++;
        }
      } catch (error) { throw new Error(`已移入废纸篓 ${deleted} 个，其余未完成。请重新扫描。${String(error)}`); }
      return { deleted, canceled: false };
    });
  });
}
