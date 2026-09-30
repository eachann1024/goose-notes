/**
 * 本地 Markdown 文件内容快照缓存。
 *
 * 目的：写盘前将待写内容与磁盘快照比较，完全相同则跳过写盘——
 * 防止「打开即写盘」场景下因格式差异或空的 normalize 触发无意义落盘。
 *
 * 生命周期：
 *   - scanner 读取文件后：setSnapshot(absPath, rawMarkdown)（含 frontmatter 的完整原文）
 *     并记录 mtimeMs+size 指纹，供 watch 快路径跳过读全文
 *   - 外部变更 reload 后：同上（内容 + stat 指纹）
 *   - 写盘成功后：setSnapshot(absPath, writtenContent)，再 stat 更新指纹
 *
 * 比较规则（白名单规范化，减少误判）：
 *   - CRLF → LF
 *   - 去除末尾空白行（trailing newlines）
 *
 * 指纹（mtimeMs + size，绝不使用 atime）：其他应用只是打开/读取文件时
 * macOS 可能发 fs.watch change 但不改 mtime/size，快路径直接忽略。
 */

export type LocalMdFileStat = {
  mtimeMs: number;
  size: number;
};

type SnapshotEntry = {
  content: string;
  mtimeMs?: number;
  size?: number;
};

const snapshotMap = new Map<string, SnapshotEntry>();

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

export function setLocalMdSnapshot(absPath: string, rawContent: string): void {
  // 只写入内容时丢掉旧指纹，避免沿用过期 mtime/size。
  snapshotMap.set(absPath, { content: rawContent });
}

export function getLocalMdSnapshot(absPath: string): string | undefined {
  return snapshotMap.get(absPath)?.content;
}

/**
 * 比较待写内容与快照，规范化后相同则返回 true（可跳过写盘）。
 */
export function isLocalMdUnchanged(
  absPath: string,
  pendingContent: string,
): boolean {
  const snapshot = snapshotMap.get(absPath)?.content;
  if (snapshot === undefined) return false;
  return normalize(pendingContent) === normalize(snapshot);
}

/**
 * 写盘成功后调用，将快照更新为写入内容。
 * 指纹需由调用方随后 `updateSnapshotStat` 补齐。
 */
export function updateSnapshotAfterWrite(
  absPath: string,
  writtenContent: string,
): void {
  snapshotMap.set(absPath, { content: writtenContent });
}

/**
 * 写入或刷新 mtimeMs+size 指纹。无内容快照时不单独建条目。
 */
export function updateSnapshotStat(
  absPath: string,
  stat: LocalMdFileStat,
): void {
  const existing = snapshotMap.get(absPath);
  if (!existing) return;
  existing.mtimeMs = stat.mtimeMs;
  existing.size = stat.size;
}

/**
 * mtimeMs 与 size 均与快照一致、且文件 mtime 距今超过 2.5s 时返回 true（可跳过读全文）。
 * 缺指纹时返回 false，调用方应退回读全文比对。
 */
// FAT/exFAT 的 mtime 粒度约 2s，同一窗口内两次不同写入可能 mtime、size 都相同；近 2.5s 内改过的不走快路径。
export function isStatMatchingSnapshot(
  absPath: string,
  stat: LocalMdFileStat,
): boolean {
  const existing = snapshotMap.get(absPath);
  if (
    existing === undefined ||
    existing.mtimeMs === undefined ||
    existing.size === undefined
  ) {
    return false;
  }
  return (
    existing.mtimeMs === stat.mtimeMs &&
    existing.size === stat.size &&
    Date.now() - stat.mtimeMs > 2500
  );
}

// ── 自写回声抑制 ─────────────────────────────────────────────────────────────
// 本应用写盘也会触发 fs.watch 的 change 事件（自写回声）。watch 处理器需要
// 区分「自己刚写的盘」和「外部修改」，否则自动保存后必弹假冲突提示。
// 主判据是内容 diff（写后快照已更新，回声读盘必与快照一致），这里的时间窗
// 是双保险：覆盖「watch 事件在写入未完成时触发、读到半截内容」的边缘情况。
const selfWriteTimestamps = new Map<string, number>();

export function markSelfWrite(absPath: string): void {
  selfWriteTimestamps.set(absPath, Date.now());
}

export function wasRecentlySelfWritten(
  absPath: string,
  windowMs = 2000,
): boolean {
  const t = selfWriteTimestamps.get(absPath);
  return t !== undefined && Date.now() - t < windowMs;
}

export function deleteLocalMdSnapshot(absPath: string): void {
  snapshotMap.delete(absPath);
}

/** 清空进程内的本地文件快照与自写标记，不会删除或改写任何磁盘文件。 */
export function clearAllLocalMdSnapshots(): void {
  snapshotMap.clear();
  selfWriteTimestamps.clear();
}

/**
 * 检查磁盘当前内容是否与快照一致（规范化后比较）。
 * 返回 true 表示磁盘未被外部修改，false 表示已被外部修改或快照不存在。
 * 用于写盘前冲突检测：快照 = 上次写盘/加载时的磁盘状态；若磁盘内容已变 = 外部修改。
 */
export function isDiskContentMatchingSnapshot(
  absPath: string,
  diskContent: string,
): boolean {
  const snapshot = snapshotMap.get(absPath)?.content;
  if (snapshot === undefined) return true; // 无快照 = 无从比较，放行
  return normalize(diskContent) === normalize(snapshot);
}

/**
 * 按快照原文的「尾换行风格」修正待写内容（最小 diff 原则）：
 * - 原文以 N 个 \n 结尾 → 待写内容也以恰好 N 个 \n 结尾（保真还原 POSIX 尾换行）
 * - 原文不以 \n 结尾 → 不补
 * - 无快照 → 默认补一个 \n（POSIX 惯例）
 * blocksToMarkdown 输出不带尾 \n，不经此修正每次编辑都会丢掉原文件的尾换行，
 * 给 git diff 制造 "\ No newline at end of file" 噪音。
 * 写后快照更新存的是修正后的实际写盘内容，尾换行风格随之延续，后续 diff 仍命中。
 */
export function applyTrailingNewlineStyle(
  absPath: string,
  content: string,
): string {
  const body = content.replace(/\n+$/, "");
  const snapshot = snapshotMap.get(absPath)?.content;
  if (snapshot === undefined) return `${body}\n`;
  const trailing = snapshot.match(/\n*$/)?.[0] ?? "";
  return body + trailing;
}
