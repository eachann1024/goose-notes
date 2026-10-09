import { app, BrowserWindow, ipcMain, Notification, safeStorage } from "electron";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { normalizedGitRemote, unknownGitVisibility, validateGitRepository, validateRepositoryId, type GitRepositoryConfig, type GitRepositoryInput, type GitSyncState, type GitSyncStatus, type GitVisibilityCheck } from "../../src/lib/git-sync-contract";
import { assertAllowed, findVaultRootContaining, normalizePath } from "./allowlist";
import { broadcast, lookupWindowContext } from "./windows";
import { syncGitRepository, validateGitSyncFolder } from "./gitRepositoryEngine";
import { lockGitSyncPath } from "./gitSyncLock";
import { GitSyncSerialQueue, migrateGitSyncState, type GitMappingHistory } from "./gitSyncStore";
import { checkGitVisibility } from "./gitSyncVisibility";
import { durableAtomicWrite } from "./gitSyncDisk";

const configs = new Map<string, GitRepositoryConfig>();
const statuses = new Map<string, GitSyncStatus>();
const nextRun = new Map<string, number>();
const notifications = new Map<string, string>();
const queue = new GitSyncSerialQueue();
let mappingHistory: GitMappingHistory = Object.create(null);
let tokens: Record<string, string> = Object.create(null);
const pendingReplies = new Map<string, { senderId: number; finish: (error: string | null) => void }>();
let stopped = false;
let ticking = false;
let timer: NodeJS.Timeout | undefined;
let loadPromise: Promise<void> | undefined;
const configFile = () => path.join(app.getPath("userData"), "git-sync.json");
const tokenFile = () => path.join(app.getPath("userData"), "git-sync-tokens.json");
const idle = (repositoryId: string): GitSyncStatus => ({ repositoryId, phase: "idle", lastSyncedAt: null, error: null });
const state = (): GitSyncState => structuredClone({ configs: [...configs.values()].map((config) => ({ ...config, hasToken: Boolean(tokens[config.id]) })), statuses: [...statuses.values()] });
const publish = () => broadcast("git-sync:state", state());
const messageOf = (error: unknown) => error instanceof Error && /^[\u3400-\u9fff]/.test(error.message) ? error.message.slice(0, 500) : "同步操作失败，请检查文件夹、SSH 权限和网络后重试";

function notifyFailure(id: string, message: string) {
  if (notifications.get(id) === message) return;
  notifications.set(id, message);
  if (Notification.isSupported()) new Notification({ title: "鹅的笔记 · Git 同步异常", body: message.slice(0, 400) }).show();
}

async function atomic(file: string, value: unknown) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await durableAtomicWrite(file, JSON.stringify(value, null, 2));
}

async function load() {
  if (!loadPromise) loadPromise = (async () => {
    try {
      const saved = migrateGitSyncState(JSON.parse(await readFile(configFile(), "utf8")));
      mappingHistory = saved.mappingHistory;
      for (const config of saved.configs) { configs.set(config.id, config); nextRun.set(config.id, Date.now() + config.intervalMinutes * 60_000); }
      for (const status of saved.statuses) statuses.set(status.repositoryId, status);
      await persist();
    } catch (error) {
      configs.clear(); statuses.clear();
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw Object.assign(new Error("无法读取 Git 同步配置，已停止同步以保护现有文件"), { cause: error });
    }
    try {
      const raw = JSON.parse(await readFile(tokenFile(), "utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
      for (const [id, encrypted] of Object.entries(raw)) { validateRepositoryId(id); if (typeof encrypted !== "string") throw new Error(); tokens[id] = encrypted; }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw Object.assign(new Error("无法读取加密的可见性检查凭据"), { cause: error }); }
  })();
  return loadPromise;
}

async function persist() {
  await atomic(configFile(), { version: 2, ...state(), mappingHistory });
}

function assertWorkspace(event: Electron.IpcMainInvokeEvent) {
  if (event.senderFrame !== event.sender.mainFrame || lookupWindowContext(BrowserWindow.fromWebContents(event.sender))?.kind !== "workspace") throw new Error("请从笔记工作区操作 Git 同步");
}

async function checkedRoot(localPath: string) {
  const allowed = assertAllowed(localPath);
  const stat = await lstat(allowed);
  const root = await realpath(allowed);
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalizePath(root) !== normalizePath(allowed)) throw new Error("同步文件夹不能使用符号链接");
  assertAllowed(root);
  const vault = findVaultRootContaining(root);
  if (!vault || normalizePath(await realpath(vault)) !== normalizePath(root)) throw new Error("只能同步已打开笔记本的根文件夹");
  return root;
}

function prepareWindow(win: BrowserWindow, roots: string[], requestId: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish("工作区未响应，已跳过同步；请等待窗口加载完成后重试"), 20_000);
    const finish = (error: string | null) => {
      clearTimeout(timeout); pendingReplies.delete(requestId);
      win.webContents.removeListener("destroyed", destroyed);
      if (error) reject(new Error("工作区未能保存全部笔记，已停止同步；请检查未保存内容后重试")); else resolve();
    };
    const destroyed = () => finish("工作区已关闭");
    win.webContents.once("destroyed", destroyed);
    pendingReplies.set(requestId, { senderId: win.webContents.id, finish });
    try { win.webContents.send("git-sync:prepare", requestId, roots); }
    catch { finish("工作区已关闭"); }
  });
}

async function sync(repositoryId: string): Promise<GitSyncState> {
  const found = configs.get(repositoryId);
  if (!found) throw new Error("请先保存同步配置");
  const config = structuredClone(found);
  if ([...configs.values()].some((other) => other.id !== config.id && normalizedGitRemote(other) === normalizedGitRemote(config) && other.branch === config.branch)) throw new Error("多个配置指向同一仓库分支，请先移除重复配置");
  statuses.set(repositoryId, { ...(statuses.get(repositoryId) ?? idle(repositoryId)), phase: "syncing", error: null }); publish();
  const unlocks: (() => void)[] = [];
  const roots: string[] = [];
  const prepared: { win: BrowserWindow; requestId: string }[] = [];
  try {
    for (const folder of config.folders) { folder.localPath = await checkedRoot(folder.localPath); roots.push(folder.localPath); }
    const windows = BrowserWindow.getAllWindows().filter((win) => lookupWindowContext(win)?.kind === "workspace");
    if (!windows.length && roots.length) throw new Error("请保持笔记工作区打开以进行同步");
    const requests = windows.map((win) => ({ win, requestId: randomUUID() }));
    prepared.push(...requests);
    const results = await Promise.allSettled(requests.map(({ win, requestId }) => prepareWindow(win, roots, requestId)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    for (const root of roots) unlocks.push(lockGitSyncPath(root));
    await syncGitRepository(config, { storageRoot: path.join(app.getPath("userData"), "git-sync-repositories"), verifyRoot: async (root) => { await checkedRoot(root); } });
    statuses.set(repositoryId, { repositoryId, phase: "idle", lastSyncedAt: new Date().toISOString(), error: null });
    await persist(); notifications.delete(repositoryId);
  } catch (error) {
    const message = messageOf(error);
    statuses.set(repositoryId, { ...(statuses.get(repositoryId) ?? idle(repositoryId)), phase: "error", error: message });
    notifyFailure(repositoryId, message);
  } finally {
    unlocks.reverse().forEach((unlock) => unlock());
    for (const { win, requestId } of prepared) if (!win.isDestroyed()) win.webContents.send("git-sync:finish", requestId);
    for (const root of roots) broadcast("desktop:fs-change", { path: root, type: "rename" });
    nextRun.set(repositoryId, Date.now() + config.intervalMinutes * 60_000); publish();
  }
  return state();
}

async function tick() {
  if (ticking || stopped) return;
  ticking = true;
  try {
    await queue.run(async () => {
      await load(); if (stopped) return;
      const due = [...configs.values()].find((config) => config.enabled && config.folders.length && (nextRun.get(config.id) ?? 0) <= Date.now());
      if (due) await sync(due.id);
    });
  } catch (error) { notifyFailure("scheduler", messageOf(error)); }
  finally { ticking = false; }
}

export function startGitSync() {
  stopped = false; timer = setInterval(() => { void tick(); }, 5000); timer.unref();
  void queue.run(load).catch((error) => notifyFailure("scheduler", messageOf(error)));
}
export function stopGitSync() { stopped = true; clearInterval(timer); }

async function save(raw: GitRepositoryInput) {
  let input = validateGitRepository(raw);
  const previous = configs.get(input.id);
  if (previous) {
    const manifest = await readFile(path.join(app.getPath("userData"), "git-sync-repositories", input.id, "manifest.json"), "utf8").then((value) => JSON.parse(value)).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw new Error("无法读取同步恢复记录"); });
    if (manifest?.pending && JSON.stringify(input.folders.map((folder) => [folder.notebookId, folder.localPath])) !== JSON.stringify(previous.folders.map((folder) => [folder.notebookId, folder.localPath]))) throw new Error("上次同步尚未恢复完成，请先同步原文件夹再修改选择");
  }
  if (previous && (normalizedGitRemote(input) !== normalizedGitRemote(previous) || input.branch !== previous.branch || input.layout !== previous.layout)) throw new Error("已保存仓库的地址、分支和布局不可修改；请新建配置");
  if (!previous && input.layout === "legacy-root") throw new Error("新仓库必须使用子目录布局");
  if ([...configs.values()].some((other) => other.id !== input.id && normalizedGitRemote(other) === normalizedGitRemote(input) && other.branch === input.branch)) throw new Error("此仓库分支已有同步配置");
  const addsFolder = input.folders.some((folder) => !previous?.folders.some((old) => old.notebookId === folder.notebookId));
  const history = mappingHistory[input.id] ?? [];
  for (const folder of input.folders) {
    if (addsFolder) {
      folder.localPath = await checkedRoot(folder.localPath);
      await validateGitSyncFolder(folder.localPath);
    }
    const old = history.find((entry) => entry.notebookId === folder.notebookId || normalizePath(entry.localPath).toLowerCase() === normalizePath(folder.localPath).toLowerCase());
    if (old) {
      if (old.notebookId !== folder.notebookId || normalizePath(old.localPath) !== normalizePath(folder.localPath)) throw new Error("原文件夹身份或路径已变化，请创建新的映射");
      folder.remotePath = old.remotePath;
    }
    if (history.some((entry) => entry.notebookId !== folder.notebookId && entry.remotePath.toLowerCase() === folder.remotePath.toLowerCase())) throw new Error("此远端子目录已保留给其他笔记本，请使用新名称");
  }
  input = validateGitRepository(input);
  if (input.layout === "legacy-root" && input.folders.some((folder) => !history.some((old) => old.notebookId === folder.notebookId && old.localPath === folder.localPath))) throw new Error("旧布局只能重新选择原文件夹");
  input = { ...input, remoteUrl: previous?.remoteUrl ?? input.remoteUrl };
  const added = input.folders.some((folder) => !previous?.folders.some((old) => old.notebookId === folder.notebookId));
  const config: GitRepositoryConfig = { ...input, visibility: previous?.visibility ?? unknownGitVisibility(), hasToken: Boolean(tokens[input.id]) };
  const previousHistory = mappingHistory[input.id];
  const previousStatus = statuses.get(input.id);
  configs.set(input.id, config);
  mappingHistory[input.id] = [...history.filter((old) => !input.folders.some((folder) => folder.notebookId === old.notebookId)), ...input.folders];
  statuses.set(input.id, previousStatus ?? idle(input.id));
  try { await persist(); }
  catch (error) {
    if (previous) configs.set(input.id, previous); else configs.delete(input.id);
    if (previousHistory) mappingHistory[input.id] = previousHistory; else delete mappingHistory[input.id];
    if (previousStatus) statuses.set(input.id, previousStatus); else statuses.delete(input.id);
    throw error;
  }
  nextRun.set(input.id, Date.now() + input.intervalMinutes * 60_000); publish();
  // This runs inside the same serialized operation: saving a newly selected folder always
  // gets its own sync attempt, including while automatic sync is disabled.
  return added ? sync(input.id) : state();
}

async function visibility(request: GitVisibilityCheck) {
  if (!request || typeof request !== "object") throw new Error("可见性检查参数无效");
  const id = validateRepositoryId(request.repositoryId), config = configs.get(id);
  if (!config) throw new Error("请先保存同步配置");
  if (request.token !== undefined && request.token !== null && (typeof request.token !== "string" || !request.token.trim() || request.token.length > 4096 || /[\r\n\0]/.test(request.token))) throw new Error("检查凭据格式无效");
  // Clear stale results even when credential persistence/decryption fails.
  config.visibility = { value: "unknown", checkedAt: new Date().toISOString(), reason: "正在检查" };
  await persist(); publish();
  try {
    if (request.token !== undefined) {
      const next = { ...tokens };
      if (request.token === null) delete next[id];
      else {
        if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("系统安全加密不可用，无法保存可见性检查凭据");
        next[id] = safeStorage.encryptString(request.token.trim()).toString("base64");
      }
      await atomic(tokenFile(), next); tokens = next;
    }
    let token: string | undefined;
    if (tokens[id]) {
      if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("系统安全加密不可用，无法读取检查凭据");
      try { token = safeStorage.decryptString(Buffer.from(tokens[id]!, "base64")); }
      catch { throw new Error("无法解密可见性检查凭据，请重新输入或清除"); }
    }
    config.visibility = await checkGitVisibility(config, token);
    await persist(); publish(); return state();
  } catch (error) {
    config.visibility = { value: "unknown", checkedAt: new Date().toISOString(), reason: messageOf(error) };
    await persist(); publish(); throw error;
  }
}

export function registerGitSyncIpc() {
  ipcMain.handle("git-sync:check-folder", async (event, localPath: unknown) => {
    assertWorkspace(event);
    try {
      if (typeof localPath !== "string") throw new Error("文件夹路径无效");
      await validateGitSyncFolder(await checkedRoot(localPath));
      return { error: null };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return { error: code === "ENOENT" ? "文件夹或文件已不存在，请重新打开笔记本" : code === "EACCES" || code === "EPERM" ? "没有读取文件夹的权限，请检查权限" : messageOf(error) };
    }
  });
  ipcMain.on("git-sync:prepare-reply", (event, requestId: string, error: string | null) => {
    if (typeof requestId !== "string") return;
    const pending = pendingReplies.get(requestId);
    if (!pending || event.sender.id !== pending.senderId || event.senderFrame !== event.sender.mainFrame) return;
    pending.finish(error === null ? null : "工作区无法保存，已停止同步");
  });
  const handle = (channel: string, operation: (value: never) => Promise<GitSyncState>) => {
    ipcMain.handle(channel, async (event, value) => {
      assertWorkspace(event);
      // Deliberately drop the cause at IPC: native errors can contain paths or credentials.
      // eslint-disable-next-line preserve-caught-error
      return queue.run(async () => { try { await load(); return await operation(value as never); } catch (error) { throw new Error(messageOf(error)); } });
    });
  };
  handle("git-sync:state", async () => state());
  handle("git-sync:save", save);
  handle("git-sync:now", async (value) => sync(validateRepositoryId(value)));
  handle("git-sync:visibility", visibility);
  handle("git-sync:remove", async (value) => {
    const id = validateRepositoryId(value), previous = configs.get(id), previousStatus = statuses.get(id);
    configs.delete(id); statuses.delete(id);
    try { await persist(); }
    catch (error) { if (previous) configs.set(id, previous); if (previousStatus) statuses.set(id, previousStatus); throw error; }
    // Retain notebook files, remote files, mapping identity and recovery data. Remove the token.
    const next = { ...tokens }; delete next[id]; await atomic(tokenFile(), next); tokens = next;
    nextRun.delete(id); notifications.delete(id); publish(); return state();
  });
}
