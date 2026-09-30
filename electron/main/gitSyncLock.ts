import path from "node:path";

const lockedRoots = new Map<string, { done: Promise<void>; release: () => void }>();
const normalize = (value: string) => process.platform === "win32" || process.platform === "darwin" ? path.resolve(value).toLowerCase() : path.resolve(value);

export function isGitSyncPathLocked(target: string): boolean {
  const resolved = normalize(target);
  return [...lockedRoots.keys()].some((root) => {
    const relative = path.relative(root, resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });
}

export function lockGitSyncPath(root: string): () => void {
  const key = normalize(root);
  let release!: () => void;
  const done = new Promise<void>((resolve) => { release = resolve; });
  lockedRoots.set(key, { done, release });
  return () => {
    lockedRoots.get(key)?.release();
    lockedRoots.delete(key);
  };
}

export async function waitForGitSyncRead(target: string): Promise<void> {
  const resolved = normalize(target);
  await Promise.all([...lockedRoots.entries()].filter(([root]) => {
    const relative = path.relative(root, resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }).map(([, lock]) => lock.done));
}

export function assertGitSyncWritable(target: string): void {
  if (isGitSyncPathLocked(target)) throw new Error("此记事本正在同步，请稍后重试文件操作");
}
