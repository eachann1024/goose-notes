import {
  encodeUnsupportedMarkdownForEditor,
  extractFrontmatter,
} from "@/lib/markdown-raw-guard";
import { parseLocalFrontmatterBlob } from "@/lib/local-frontmatter";
import {
  restoreBlockPropsMarkers,
  unwrapLocalBlockPropsWrappers,
} from "@/lib/export/markdown/blockPropsMarker";
import {
  setLocalMdSnapshot,
  updateSnapshotStat,
  type LocalMdFileStat,
} from "@/lib/local-md-snapshot";
import type { FontFamily, JSONContent, Page } from "@/types";
import {
  buildLocalPageId,
  normalizeLocalFileTitle,
  type LocalFolderEntry,
} from "./entries";

export interface ParsedLocalMarkdown {
  content: JSONContent;
  frontmatter?: string;
  fontFamily: FontFamily;
  pageLayout?: import("@/types").PageLayout;
  isLocked: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  readState: "ready" | "error";
  readError?: string;
}

// 把磁盘上的 markdown 解析成编辑器内容（供初次扫描和外部变更后重新读取复用）。
export async function parseLocalMarkdownContent(
  markdown: string | null,
  fallbackTitle: string,
  readError?: string,
): Promise<ParsedLocalMarkdown> {
  if (markdown === null) {
    // SAFETY: 空文档以空数组作为 JSONContent 占位表示
    return {
      content: [] as unknown as JSONContent,
      fontFamily: "default",
      isLocked: false,
      isPinned: false,
      isFavorite: false,
      readState: "error",
      readError: readError || "Markdown 文件读取失败",
    };
  }

  // 1) 抽出 frontmatter：仍填 localFrontmatter + goose 设置（font/locked/pinned/favorite）。
  //    仅当 YAML 含用户属性时才作为编辑器首块 yaml-frontmatter 出现。
  // 2) 对整份 markdown 做 encode（包住非标 HTML 块等），避免被 markdown-it 误解析；
  //    文件头 --- 由 markdownToJsonContent 识别成 yaml-frontmatter 代码块。
  // 3) 内容保持解析原样：preserveStructure 关闭「首块提升 H1」的标题注入，
  //    无 H1 的文件解析后首块保持段落（「文件名标题绑定」已废弃）。
  //    侧栏/tab 标题由 getPageTitle() 从 localFilePath 文件名取得，不依赖 H1。
  //    首块 H1 约束仅对内部笔记本有效，local-folder 页面使用虚拟标题方案。
  // 4) 从 frontmatter 恢复 goose-font / goose-locked / goose-pinned / goose-favorite（解析失败则默认，blob 仍原样保留）
  const { frontmatter } = extractFrontmatter(markdown);
  const unclosedFrontmatter =
    /^---[^\S\r\n]*(?:\r?\n|$)/.test(markdown) && !frontmatter;
  const fmSettings = parseLocalFrontmatterBlob(frontmatter).settings;
  // 先拆本地文件夹专用的最外层块级 span，再交给通用 inline parser，
  // 避免它把 wrapper 与内部颜色 span 误配成嵌套行内样式。
  // 注意：走整份 markdown，不再只喂 body，否则文件头 YAML 永远进不了编辑器。
  const encodedMd = encodeUnsupportedMarkdownForEditor(
    unwrapLocalBlockPropsWrappers(markdown),
  );
  const { importFromMarkdown } = await import("@/lib/export");
  const imported = importFromMarkdown(encodedMd, fallbackTitle, {
    preserveStructure: true,
  });
  const importedBlocks = Array.isArray(imported.content)
    ? imported.content
    : [];

  // SAFETY: restoreBlockPropsMarkers 返回的 block 结构符合 JSONContent
  return {
    content: restoreBlockPropsMarkers(
      importedBlocks as any,
    ) as unknown as JSONContent,
    frontmatter: frontmatter || undefined,
    fontFamily: fmSettings.fontFamily,
    pageLayout: fmSettings.pageLayout,
    isLocked: fmSettings.isLocked,
    isPinned: fmSettings.isPinned,
    isFavorite: fmSettings.isFavorite,
    readState: imported.success && !unclosedFrontmatter ? "ready" : "error",
    readError: unclosedFrontmatter
      ? "YAML 前置区未闭合，原文件已保留，请修复后重新载入"
      : imported.success
        ? undefined
        : imported.error || "Markdown 解析失败",
  };
}

export async function buildMarkdownPage(
  notebookId: string,
  basePath: string,
  entry: LocalFolderEntry,
  readResult: {
    content: string | null;
    error?: string;
    stat?: LocalMdFileStat;
  },
  now: number,
  resolvedId?: string,
): Promise<Page> {
  const fallbackTitle = normalizeLocalFileTitle(entry.name);
  const fileId =
    resolvedId ?? buildLocalPageId(notebookId, basePath, entry.path);
  const parsed = await parseLocalMarkdownContent(
    readResult.content,
    fallbackTitle,
    readResult.error,
  );

  // 记录磁盘原始内容快照（含 frontmatter）与 mtime+size 指纹，
  // 供写盘前 diff 与 watch 快路径跳过无实质变更的读全文。
  if (typeof readResult.content === "string") {
    setLocalMdSnapshot(entry.path, readResult.content);
    if (readResult.stat) {
      updateSnapshotStat(entry.path, readResult.stat);
    }
  }

  return {
    id: fileId,
    workspaceId: notebookId,
    content: parsed.content,
    isFolder: false,
    isLocked: parsed.isLocked,
    isPinned: parsed.isPinned || undefined,
    pinnedAt: parsed.isPinned ? now : undefined,
    isFavorite: parsed.isFavorite || undefined,
    fontSize: "default",
    fontFamily: parsed.fontFamily,
    pageLayout: parsed.pageLayout,
    localFilePath: entry.path,
    localFrontmatter: parsed.frontmatter,
    localReadState: parsed.readState,
    localReadError: parsed.readError,
    createdAt: now,
    updatedAt: now,
  };
}
