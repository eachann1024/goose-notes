import { usePages } from "@/stores/usePages";

export function normalizePath(filePath: string): string {
  const slashPath = filePath.replace(/\\/g, "/");
  const prefix =
    slashPath.match(/^[A-Za-z]:/)?.[0] ??
    (slashPath.startsWith("/") ? "/" : "");
  const rest =
    prefix === "/" ? slashPath.slice(1) : slashPath.slice(prefix.length);
  const segments: string[] = [];
  for (const segment of rest.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  const joined = segments.join("/");
  return prefix === "/"
    ? `/${joined}`
    : `${prefix}${joined ? `/${joined}` : ""}`;
}

export function comparisonPath(filePath: string): string {
  const normalized = normalizePath(filePath).replace(/\/$/, "");
  return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isPathInsideRoot(filePath: string, rootPath: string): boolean {
  const file = comparisonPath(filePath);
  const root = comparisonPath(rootPath);
  return file.startsWith(`${root}/`);
}

export async function assertLocalPathInsideRoot(
  filePath: string,
  rootPath: string,
  options: { targetMayNotExist?: boolean } = {},
): Promise<void> {
  if (!isPathInsideRoot(filePath, rootPath)) {
    throw new Error("本地文件位于笔记本根目录之外");
  }
  const fs = typeof window !== "undefined" ? window.gooseFs : undefined;
  if (!fs?.realpathAsync) return;
  const canonicalRoot = await fs.realpathAsync(rootPath);
  const canonicalTarget = await fs.realpathAsync(
    options.targetMayNotExist ? dirname(filePath) : filePath,
  );
  const targetForComparison = options.targetMayNotExist
    ? `${canonicalTarget ?? ""}/placeholder.md`
    : (canonicalTarget ?? "");
  if (
    !canonicalRoot ||
    !canonicalTarget ||
    !isPathInsideRoot(targetForComparison, canonicalRoot)
  ) {
    throw new Error("本地文件的真实路径位于笔记本根目录之外");
  }
}

export function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const index = normalized.lastIndexOf("/");
  return index <= 0
    ? normalized.slice(0, Math.max(index, 1))
    : normalized.slice(0, index);
}

export function basenameWithoutMarkdownExtension(filePath: string): string {
  return (
    normalizePath(filePath)
      .split("/")
      .pop()
      ?.replace(/\.(md|markdown)$/i, "") ?? ""
  );
}

export function markdownExtension(filePath: string): string {
  return normalizePath(filePath).match(/\.(md|markdown)$/i)?.[0] ?? ".md";
}

export function sanitizeLocalTitle(title: string): string {
  return (title.trim() || "无标题").replace(/[\\/:*?"<>|]/g, "_");
}

export async function pathExists(filePath: string): Promise<boolean> {
  const fs = typeof window !== "undefined" ? window.gooseFs : undefined;
  if (!fs) return false;
  try {
    return fs.existsAsync
      ? await fs.existsAsync(filePath)
      : fs.exists(filePath);
  } catch {
    return false;
  }
}

export function pageAtLocalPath(filePath: string) {
  const key = comparisonPath(filePath);
  return Object.values(usePages.getState().pages).find(
    (page) => page.localFilePath && comparisonPath(page.localFilePath) === key,
  );
}

export async function allocatePlannedLocalPath(params: {
  directory: string;
  title: string;
  extension?: string;
  currentPath?: string;
  reserved: Set<string>;
}): Promise<string> {
  const base = sanitizeLocalTitle(params.title);
  const extension = params.extension ?? ".md";
  for (let suffix = 0; suffix <= 99; suffix += 1) {
    const name = suffix === 0 ? base : `${base} (${suffix})`;
    const candidate = normalizePath(`${params.directory}/${name}${extension}`);
    const key = comparisonPath(candidate);
    const isCurrent = params.currentPath
      ? comparisonPath(params.currentPath) === key
      : false;
    const occupiedByPage = Object.values(usePages.getState().pages).some(
      (page) =>
        page.localFilePath &&
        comparisonPath(page.localFilePath) === key &&
        (!params.currentPath ||
          comparisonPath(page.localFilePath) !==
            comparisonPath(params.currentPath)),
    );
    if (
      !params.reserved.has(key) &&
      !occupiedByPage &&
      (isCurrent || !(await pathExists(candidate)))
    ) {
      params.reserved.add(key);
      return candidate;
    }
  }
  throw new Error("无法生成可用的本地文件名");
}
