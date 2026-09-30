/**
 * 行内代码相对路径 tag 的判定与存在性探测。
 *
 * 纯函数部分（isRelativePathCandidate / resolveCandidatePath / isInsideRoot）
 * 不碰 IO；probePath 用带 TTL 的模块级缓存做存在性探测，供 decoration 插件
 * 同步查缓存（peekProbe）+ 异步回填（probePath 完成后触发重扫）。
 */

import { resolvePhysicalResourcePath } from "@/components/editor/utils/openResourceExternally";

const MAX_PATH_LENGTH = 512;
const PROBE_TTL_MS = 5000;
const PROBE_CACHE_MAX = 300;

/** 取最后一段（/ 与 \ 都切分）。 */
function lastSegment(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1];
}

/**
 * 最后一段是否有扩展名：存在一个不在首位、且后面还有内容的 `.`。
 * 隐藏文件如 `.env` 的 `.` 在首位，按无扩展名处理（会被补成 `.env.md`，可接受）。
 */
function hasExtension(segment: string): boolean {
  const dot = segment.lastIndexOf(".");
  return dot > 0 && dot < segment.length - 1;
}

/**
 * 行内代码文本是否形似指向 Markdown 笔记的显式相对路径。
 * 只认 ./ 与 ../ 前缀；以 / 或 \ 结尾视为目录意图，不算候选；
 * 最后一段带扩展名时只认 .md（大小写不敏感），无扩展名算候选（探测时补 .md）。
 */
export function isRelativePathCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= 2 || trimmed.length > MAX_PATH_LENGTH) return false;
  if (!trimmed.startsWith("./") && !trimmed.startsWith("../")) return false;
  // 挡 URL、非法字符与控制字符
  if (trimmed.includes("://")) return false;
  if (/[\n\r\0|*?<>"]/.test(trimmed)) return false;
  // 前缀之后必须还有实际内容（"./" / "../" 本身不算）
  const rest = trimmed.startsWith("../") ? trimmed.slice(3) : trimmed.slice(2);
  if (rest.length === 0) return false;
  // 以斜杠结尾是目录意图，不是笔记
  if (trimmed.endsWith("/") || trimmed.endsWith("\\")) return false;
  const segment = lastSegment(trimmed);
  if (!hasExtension(segment)) return true;
  return segment.slice(segment.lastIndexOf(".")).toLowerCase() === ".md";
}

/**
 * 把候选文本补成 Markdown 目标路径（无扩展名时追加 .md）；不是候选则返回 null。
 * 隐藏文件如 ./.env 按无扩展名处理，补成 ./.env.md。
 */
export function toMarkdownTarget(text: string): string | null {
  const trimmed = text.trim();
  if (!isRelativePathCandidate(trimmed)) return null;
  const segment = lastSegment(trimmed);
  return hasExtension(segment) ? trimmed : `${trimmed}.md`;
}

/**
 * 把相对路径按笔记文件绝对路径解析成绝对路径；无法解析返回 null。
 * 直接复用 openResourceExternally 的 resolvePhysicalResourcePath：
 * 相对路径 + 有 basePath 时它走 resolveRelativePath 弹栈解析，语义一致。
 */
export function resolveCandidatePath(
  text: string,
  pageLocalFilePath: string,
): string | null {
  const trimmed = text.trim();
  if (!isRelativePathCandidate(trimmed)) return null;
  const resolved = resolvePhysicalResourcePath(trimmed, pageLocalFilePath);
  if (!resolved) return null;
  // 弹栈越界（如 ../../../../x）会得到一个语义上不可信的结果：
  // resolveRelativePath 弹到空栈后继续 push，产出「根级拼接」路径。
  // 这里校验 .. 弹栈不越过 base 的根：逐级模拟一次。
  if (escapesBase(trimmed, pageLocalFilePath)) return null;
  return resolved;
}

/** 模拟弹栈，判断相对路径是否越过 base 目录的根（栈被弹空）。 */
function escapesBase(reference: string, pagePath: string): boolean {
  const separator = pagePath.includes("\\") ? "\\" : "/";
  const base = pagePath.replace(/[\\/][^\\/]+$/, "");
  const parts = `${base}${separator}${reference}`.split(/[\\/]/);
  let depth = 0;
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (depth === 0) return true;
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  return false;
}

/** 归一化为可比较形式：统一斜杠、压缩重复斜杠、去尾斜杠；含盘符则整体小写。 */
function comparisonPath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  normalized = normalized.replace(/\/+$/, "");
  return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
}

/** 绝对路径是否在 root 内（root 自身不算命中，必须是 root 的子孙）。 */
export function isInsideRoot(absPath: string, root: string): boolean {
  const abs = comparisonPath(absPath);
  const base = comparisonPath(root);
  if (!base) return false;
  return abs.startsWith(`${base}/`);
}

export type PathProbeState = "unknown" | "pending" | "hit" | "miss";

type ProbeEntry = { state: "pending" | "hit" | "miss"; ts: number };

const probeCache = new Map<string, ProbeEntry>();

function rememberProbe(absPath: string, entry: ProbeEntry): void {
  probeCache.delete(absPath);
  probeCache.set(absPath, entry);
  // 超容量删最老（Map 迭代序即插入序）
  while (probeCache.size > PROBE_CACHE_MAX) {
    const oldest = probeCache.keys().next().value as string | undefined;
    if (oldest === undefined) return;
    probeCache.delete(oldest);
  }
}

/** 同步查缓存，不发起 IO。 */
export function peekProbe(absPath: string): PathProbeState {
  const entry = probeCache.get(absPath);
  if (!entry) return "unknown";
  if (Date.now() - entry.ts > PROBE_TTL_MS) {
    probeCache.delete(absPath);
    return "unknown";
  }
  return entry.state;
}

/** 发起（或复用）存在性探测；resolve 后调用 onSettled 通知重绘。 */
export function probePath(
  absPath: string,
  existsAsync: (p: string) => Promise<boolean>,
  onSettled: () => void,
): void {
  if (peekProbe(absPath) !== "unknown") return;
  rememberProbe(absPath, { state: "pending", ts: Date.now() });
  existsAsync(absPath).then(
    (exists) => {
      rememberProbe(absPath, { state: exists ? "hit" : "miss", ts: Date.now() });
      onSettled();
    },
    () => {
      // 探测失败按不存在处理，不静默降级为「存在」。
      rememberProbe(absPath, { state: "miss", ts: Date.now() });
      onSettled();
    },
  );
}

/** 仅测试用。 */
export function __resetProbeCacheForTests(): void {
  probeCache.clear();
}
