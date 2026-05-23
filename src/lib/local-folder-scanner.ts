import { importFromMarkdown } from "@/lib/export";
import {
  encodeUnsupportedMarkdownForEditor,
  extractFrontmatter,
} from "@/lib/markdown-raw-guard";
import type { JSONContent, Page } from "@/types";

const IGNORED_FOLDERS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".vscode",
  ".idea",
  "target",
  "__pycache__",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
]);

interface LocalFolderScannerOptions {
  notebookId: string;
  basePath: string;
  gooseFs: GooseFs;
}

interface LocalFolderEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
}

export function buildLocalPageId(
  notebookId: string,
  basePath: string,
  filePath: string,
): string {
  const relativePath = filePath.replace(basePath, "").replace(/^[\/\\]/, "");
  const encoded = encodeURIComponent(relativePath);
  return `local-${notebookId}-${encoded}`;
}

function normalizeLocalFileTitle(name: string) {
  const base = name.replace(/\.(md|markdown)$/i, "").trim();
  return base || "无标题";
}

function ensureLocalFileTitle(content: JSONContent, title: string): JSONContent {
  const safeContent =
    content && content.type === "doc" ? content : { type: "doc", content: [] };
  const nodes = Array.isArray(safeContent.content) ? [...safeContent.content] : [];
  const first = nodes[0];
  const hasTitleNode = first?.type === "heading" && first.attrs?.level === 1;
  const nextTitle = title.trim();

  if (hasTitleNode) {
    const hasText = first.content && first.content.length > 0;
    if (!hasText) {
      first.content = [{ type: "text", text: nextTitle }];
    }
    return { ...safeContent, content: nodes };
  }

  return {
    ...safeContent,
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: nextTitle }],
      },
      ...nodes,
    ],
  };
}

function shouldIgnoreEntry(name: string) {
  return name.startsWith(".") || IGNORED_FOLDERS.has(name);
}

async function readDirectory(gooseFs: GooseFs, dirPath: string): Promise<LocalFolderEntry[]> {
  if (gooseFs.readDirAsync) {
    return (await gooseFs.readDirAsync(dirPath)) || [];
  }
  return gooseFs.readDir(dirPath) || [];
}

async function readMarkdownFile(
  gooseFs: GooseFs,
  filePath: string,
): Promise<{ content: string | null; error?: string }> {
  if (gooseFs.readFileStatAsync) {
    const result = await gooseFs.readFileStatAsync(filePath);
    return {
      content: result.ok ? result.content ?? "" : null,
      error: result.error || undefined,
    };
  }

  if (gooseFs.readFileStat) {
    const result = gooseFs.readFileStat(filePath);
    return {
      content: result.ok ? result.content ?? "" : null,
      error: result.error || undefined,
    };
  }

  if (gooseFs.readFileAsync) {
    return {
      content: await gooseFs.readFileAsync(filePath),
    };
  }

  return {
    content: gooseFs.readFile(filePath),
  };
}

function buildFolderPage(
  notebookId: string,
  basePath: string,
  entry: LocalFolderEntry,
  parentId?: string,
): Page {
  return {
    id: buildLocalPageId(notebookId, basePath, entry.path),
    workspaceId: notebookId,
    parentId,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: entry.name }],
        },
      ],
    },
    isFolder: true,
    isLocked: false,
    isFullWidth: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: entry.path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0,
  };
}

function buildMarkdownPage(
  notebookId: string,
  basePath: string,
  entry: LocalFolderEntry,
  readResult: { content: string | null; error?: string },
  now: number,
): Page {
  const fallbackTitle = normalizeLocalFileTitle(entry.name);
  const fileId = buildLocalPageId(notebookId, basePath, entry.path);
  const markdownContent = readResult.content;

  if (markdownContent === null) {
    return {
      id: fileId,
      workspaceId: notebookId,
      content: ensureLocalFileTitle({ type: "doc", content: [] }, fallbackTitle),
      isFolder: false,
      isLocked: false,
      isFullWidth: false,
      fontSize: "default",
      fontFamily: "default",
      localFilePath: entry.path,
      localReadState: "error",
      localReadError: readResult.error || "Markdown 文件读取失败",
      createdAt: now,
      updatedAt: now,
    };
  }

  // 1) 抽出 frontmatter（不入编辑器，保存时由 saveLocalPageContent prepend 回去）
  // 2) 对剩余 body 做 encode（包住非标 HTML 块等），避免被 markdown-it 误解析
  // 3) 不再用 ensureLocalFileTitle 强塞文件名作为 H1：文件名走 tab/侧栏，文档内容保持原貌
  const { frontmatter, body } = extractFrontmatter(markdownContent);
  const encodedBody = encodeUnsupportedMarkdownForEditor(body);
  const imported = importFromMarkdown(encodedBody, fallbackTitle);
  const jsonContent = imported.content || { type: "doc", content: [] };

  return {
    id: fileId,
    workspaceId: notebookId,
    content: jsonContent,
    isFolder: false,
    isLocked: false,
    isFullWidth: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: entry.path,
    localFrontmatter: frontmatter || undefined,
    localReadState: imported.success ? "ready" : "error",
    localReadError: imported.success ? undefined : imported.error || "Markdown 解析失败",
    createdAt: now,
    updatedAt: now,
  };
}

export async function scanLocalFolderPages({
  notebookId,
  basePath,
  gooseFs,
}: LocalFolderScannerOptions): Promise<Page[]> {
  const scanDirectory = async (
    dirPath: string,
    parentId?: string,
  ): Promise<Page[]> => {
    let entries: LocalFolderEntry[] = [];

    try {
      entries = await readDirectory(gooseFs, dirPath);
    } catch (error) {
      console.error("readDir failed", error);
      return [];
    }

    const pages: Page[] = [];

    for (const entry of entries) {
      if (shouldIgnoreEntry(entry.name)) continue;

      if (entry.isDirectory) {
        const folderPage = buildFolderPage(notebookId, basePath, entry, parentId);
        pages.push(folderPage);
        const subPages = await scanDirectory(entry.path, folderPage.id);
        pages.push(...subPages);
        continue;
      }

      if (!entry.isFile || !/\.(md|markdown)$/i.test(entry.name)) {
        continue;
      }

      const now = Date.now();
      const readResult = await readMarkdownFile(gooseFs, entry.path);
      const page = buildMarkdownPage(
        notebookId,
        basePath,
        entry,
        readResult,
        now,
      );
      page.parentId = parentId;
      pages.push(page);
    }

    return pages;
  };

  return await scanDirectory(basePath);
}
