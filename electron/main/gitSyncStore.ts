import { createHash } from "node:crypto";
import { normalizedGitRemote, unknownGitVisibility, validateGitRepository, validateGitSyncConfig, type GitRepositoryConfig, type GitSyncState } from "../../src/lib/git-sync-contract";

export interface GitMappingHistory { [repositoryId: string]: GitRepositoryConfig["folders"] }
export interface GitSyncSavedState extends GitSyncState { version: 2; mappingHistory: GitMappingHistory }

/** v1 mappings keep their remote-root layout; duplicate remotes are disabled, never merged. */
export function migrateGitSyncState(saved: unknown): GitSyncSavedState {
  if (!saved || typeof saved !== "object" || !Array.isArray((saved as GitSyncState).configs)) throw new Error("同步配置文件格式无效");
  const raw = saved as GitSyncSavedState;
  const configs = raw.configs.map((item) => {
    if (raw.version === 2) {
      const config = validateGitRepository(item);
      const visibility = item.visibility && ["public", "private", "unknown"].includes(item.visibility.value) ? item.visibility : unknownGitVisibility();
      return { ...config, visibility, hasToken: false };
    }
    const legacy = validateGitSyncConfig(item as never);
    return {
      id: `legacy-${createHash("sha256").update(legacy.notebookId).digest("hex").slice(0, 24)}`,
      provider: legacy.provider, remoteUrl: legacy.remoteUrl, branch: legacy.branch,
      intervalMinutes: legacy.intervalMinutes, enabled: legacy.enabled, layout: "legacy-root" as const,
      folders: [{ notebookId: legacy.notebookId, localPath: legacy.localPath, name: "原笔记本", remotePath: "" }],
      visibility: unknownGitVisibility(), hasToken: false,
    };
  });
  if (new Set(configs.map((c) => c.id)).size !== configs.length) throw new Error("同步仓库标识重复");
  const statuses = configs.map((config) => {
    const previous = raw.statuses?.find((status) => raw.version === 2 ? status.repositoryId === config.id : (status as unknown as { notebookId: string }).notebookId === config.folders[0]?.notebookId);
    const duplicate = configs.some((other) => other.id !== config.id && normalizedGitRemote(other) === normalizedGitRemote(config) && other.branch === config.branch);
    if (duplicate) config.enabled = false;
    return { repositoryId: config.id, phase: duplicate ? "error" as const : "idle" as const, lastSyncedAt: typeof previous?.lastSyncedAt === "string" ? previous.lastSyncedAt : null, error: duplicate ? "多个旧配置指向同一仓库分支，已停用；请保留一个配置或改用独立仓库，原文件未改变" : null };
  });
  const mappingHistory: GitMappingHistory = Object.create(null);
  if (raw.version === 2 && raw.mappingHistory && typeof raw.mappingHistory === "object") {
    for (const [id, folders] of Object.entries(raw.mappingHistory)) {
      if (!Array.isArray(folders)) throw new Error("文件夹映射历史无效");
      mappingHistory[id] = folders;
    }
  }
  for (const config of configs) mappingHistory[config.id] ??= config.folders;
  return { version: 2, configs, statuses, mappingHistory };
}

export class GitSyncSerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
