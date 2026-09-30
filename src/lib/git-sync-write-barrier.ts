import { canonicalLocalPath } from "./canonicalLocalPath";

const pending = new Map<string, { root: string; done: Promise<void>; release: () => void }>();
const normalize = (value: string) => {
  const resolved = canonicalLocalPath(value).replace(/[\\/]+$/, "");
  return /Mac|Win/i.test(navigator.platform) ? resolved.toLowerCase() : resolved;
};

export function holdGitSyncWrites(requestId: string, root: string): void {
  let release!: () => void;
  const done = new Promise<void>((resolve) => { release = resolve; });
  pending.set(requestId, { root: normalize(root), done, release });
}

export function releaseGitSyncWrites(requestId: string): void {
  pending.get(requestId)?.release();
  pending.delete(requestId);
}

export async function waitForGitSyncWrites(filePath: string): Promise<void> {
  const target = normalize(filePath);
  await Promise.all([...pending.values()].filter(({ root }) => target === root || target.startsWith(`${root}/`) || target.startsWith(`${root}\\`)).map(({ done }) => done));
}
