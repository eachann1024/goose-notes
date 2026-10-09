export type GitSyncProvider = "github" | "gitee";

export interface GitSyncConfig {
  notebookId: string;
  localPath: string;
  provider: GitSyncProvider;
  remoteUrl: string;
  branch: string;
  intervalMinutes: number;
  enabled: boolean;
}

export interface GitSyncStatus {
  repositoryId: string;
  phase: "idle" | "syncing" | "error";
  lastSyncedAt: string | null;
  error: string | null;
}

export interface GitRepositoryFolder {
  notebookId: string;
  localPath: string;
  name: string;
  remotePath: string;
}

export interface GitRepositoryVisibility {
  value: "public" | "private" | "unknown";
  checkedAt: string | null;
  reason: string | null;
}

export interface GitRepositoryConfig {
  id: string;
  provider: GitSyncProvider;
  remoteUrl: string;
  branch: string;
  intervalMinutes: number;
  enabled: boolean;
  layout: "subfolders" | "legacy-root";
  folders: GitRepositoryFolder[];
  visibility: GitRepositoryVisibility;
  hasToken: boolean;
}

/** Visibility/hasToken are output-only; the main process owns them. */
export type GitRepositoryInput = Omit<GitRepositoryConfig, "visibility" | "hasToken">;
export interface GitVisibilityCheck {
  repositoryId: string;
  /** Omit to reuse the encrypted token, null to clear it. */
  token?: string | null;
}

export interface GitSyncState {
  configs: GitRepositoryConfig[];
  statuses: GitSyncStatus[];
}

export interface GitSyncBridge {
  getState: () => Promise<GitSyncState>;
  checkFolder: (localPath: string) => Promise<{ error: string | null }>;
  save: (config: GitRepositoryInput) => Promise<GitSyncState>;
  remove: (repositoryId: string) => Promise<GitSyncState>;
  syncNow: (repositoryId: string) => Promise<GitSyncState>;
  checkVisibility: (request: GitVisibilityCheck) => Promise<GitSyncState>;
  onState: (callback: (state: GitSyncState) => void) => () => void;
  onPrepare: (callback: (requestId: string, localPaths: string[]) => void) => () => void;
  replyPrepare: (requestId: string, error: string | null) => void;
  onFinish: (callback: (requestId: string) => void) => () => void;
}

export const DEFAULT_GIT_SYNC_INTERVAL = 5;

export function validateGitSyncConfig(value: GitSyncConfig): GitSyncConfig {
  if (!value || typeof value !== "object") throw new Error("同步配置无效");
  if (typeof value.notebookId !== "string" || !value.notebookId.trim()) throw new Error("请选择笔记本");
  if (typeof value.localPath !== "string" || !value.localPath.trim()) throw new Error("笔记本缺少本地文件夹");
  if (value.provider !== "github" && value.provider !== "gitee") throw new Error("请选择 GitHub 或 Gitee");
  const host = value.provider === "github" ? "github.com" : "gitee.com";
  const remoteUrl = typeof value.remoteUrl === "string" ? value.remoteUrl.trim() : "";
  const escapedHost = host.replace(".", "\\.");
  const repo = "[A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*";
  if (!new RegExp(`^(?:git@${escapedHost}:|ssh://git@${escapedHost}/)${repo}$`).test(remoteUrl)) {
    throw new Error(`仅支持 ${host} 的 SSH 仓库地址，例如 git@${host}:用户名/仓库.git`);
  }
  const branch = typeof value.branch === "string" ? value.branch.trim() : "";
  if (!branch || branch.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || /\.\.|\/\/|@\{|\.lock(?:\/|$)/.test(branch) || branch.split("/").some((part) => !part || part.startsWith(".") || part.endsWith("."))) {
    throw new Error("分支名称无效");
  }
  if (!Number.isInteger(value.intervalMinutes) || value.intervalMinutes < 1 || value.intervalMinutes > 1440) throw new Error("自动同步间隔须为 1–1440 分钟的整数");
  if (typeof value.enabled !== "boolean") throw new Error("自动同步开关无效");
  return { notebookId: value.notebookId, localPath: value.localPath, provider: value.provider, remoteUrl, branch, intervalMinutes: value.intervalMinutes, enabled: value.enabled };
}

export const unknownGitVisibility = (): GitRepositoryVisibility => ({ value: "unknown", checkedAt: null, reason: "尚未检查" });

export function normalizedGitRemote(config: Pick<GitRepositoryInput, "provider" | "remoteUrl">): string {
  const host = config.provider === "github" ? "github.com" : "gitee.com";
  const repository = config.remoteUrl.replace(/^git@[^:]+:|^ssh:\/\/git@[^/]+\//, "").replace(/\.git$/, "");
  return `git@${host}:${repository.toLowerCase()}.git`;
}

export function validateRepositoryId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value) || Object.prototype.hasOwnProperty.call(Object.prototype, value)) throw new Error("仓库标识无效");
  return value;
}

export function validateGitRepository(value: GitRepositoryInput): GitRepositoryInput {
  if (!value || typeof value !== "object") throw new Error("同步配置无效");
  const id = validateRepositoryId(value.id);
  const shared = validateGitSyncConfig({ ...value, notebookId: id, localPath: "/validation" });
  if (value.layout !== "subfolders" && value.layout !== "legacy-root") throw new Error("仓库目录布局无效");
  if (!Array.isArray(value.folders) || value.folders.length > 100 || (value.layout === "legacy-root" && value.folders.length > 1)) throw new Error("旧仓库仅支持原来的一个文件夹；请新建子目录布局仓库");
  const folders = value.folders.map((folder) => {
    if (!folder || typeof folder.notebookId !== "string" || !folder.notebookId.trim() || folder.notebookId.length > 200) throw new Error("笔记本标识无效");
    if (typeof folder.name !== "string" || !folder.name.trim() || folder.name.length > 200) throw new Error("文件夹名称无效");
    if (typeof folder.localPath !== "string" || !/^(?:\/|[A-Za-z]:[\\/])/.test(folder.localPath) || /[\0\r\n]/.test(folder.localPath) || folder.localPath.split(/[\\/]/).includes("..")) throw new Error("本地文件夹路径无效");
    if (typeof folder.remotePath !== "string" || (value.layout === "legacy-root" ? folder.remotePath !== "" : !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(folder.remotePath))) throw new Error("远端子目录须为稳定的字母、数字、下划线或连字符名称");
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(folder.remotePath)) throw new Error("远端子目录名称是系统保留名称");
    return { notebookId: folder.notebookId, name: folder.name.trim(), localPath: folder.localPath, remotePath: folder.remotePath };
  });
  for (let i = 0; i < folders.length; i++) for (let j = 0; j < i; j++) {
    const a = folders[i]!, b = folders[j]!;
    const local = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const x = local(a.localPath), y = local(b.localPath);
    if (a.notebookId === b.notebookId || a.remotePath.toLowerCase() === b.remotePath.toLowerCase() || x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)) throw new Error("仓库内的文件夹映射重复或重叠");
  }
  return { id, provider: shared.provider, remoteUrl: shared.remoteUrl, branch: shared.branch, intervalMinutes: shared.intervalMinutes, enabled: shared.enabled, layout: value.layout, folders };
}
