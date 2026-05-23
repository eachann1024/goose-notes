// 主程序读盘流转 frontmatter 用的旁路存储：
// - main.tsx 的 readFile/readFileAsync 包装器抽出 frontmatter 后写入此 Map
// - usePages.setActivePage / discardDirtyLocalPage 读完后调 consume 把
//   frontmatter 转交到 page.localFrontmatter

const normalizePath = (p: string) => p.replace(/\\/g, "/");

const frontmatterByPath = new Map<string, string | null>();

export function setFrontmatterForPath(filePath: string, frontmatter: string | null) {
  frontmatterByPath.set(normalizePath(filePath), frontmatter);
}

export function consumeFrontmatterForPath(filePath: string): string | null {
  const key = normalizePath(filePath);
  if (!frontmatterByPath.has(key)) return null;
  const v = frontmatterByPath.get(key) ?? null;
  frontmatterByPath.delete(key);
  return v;
}

export function peekFrontmatterForPath(filePath: string): string | null {
  return frontmatterByPath.get(normalizePath(filePath)) ?? null;
}
