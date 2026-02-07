import type { Page } from "@/types";
import type {
  FileChange,
  PageMeta,
  SearchResult,
  StorageAdapter,
  StorageSettings,
} from "../types";
import {
  extractTitleFromContent,
  generateFileName,
  joinPath,
  normalizeSlash,
  pageToMarkdown,
} from "../utils";

const readDirCompat = async (fs: GooseFs, dirPath: string): Promise<any[]> => {
  if (fs.readDirAsync) {
    return fs.readDirAsync(dirPath);
  }
  return fs.readDir(dirPath);
};

const readFileCompat = async (
  fs: GooseFs,
  filePath: string,
): Promise<string | null> => {
  if (fs.readFileAsync) {
    return fs.readFileAsync(filePath);
  }
  return fs.readFile(filePath);
};

const writeFileCompat = async (
  fs: GooseFs,
  filePath: string,
  content: string,
): Promise<boolean> => {
  if (fs.writeFileAsync) {
    return fs.writeFileAsync(filePath, content);
  }
  return fs.writeFile(filePath, content);
};

const existsCompat = async (fs: GooseFs, filePath: string): Promise<boolean> => {
  if (fs.existsAsync) {
    return fs.existsAsync(filePath);
  }
  return fs.exists(filePath);
};

export class MarkdownStorageAdapter implements StorageAdapter {
  readonly mode = "markdown-only";
  isReady = false;

  private workspacePath: string;
  private settings: StorageSettings;
  private unwatch: (() => void) | null = null;
  private fileChangeCallbacks: ((change: FileChange) => void)[] = [];

  constructor(settings: StorageSettings) {
    this.settings = settings;
    this.workspacePath = settings.workspacePath;
  }

  async initialize(): Promise<void> {
    if (!this.workspacePath) {
      throw new Error("Workspace path not set");
    }

    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const exists = await existsCompat(tauriGooseFs, this.workspacePath);
    if (!exists) {
      await tauriGooseFs.mkdir(this.workspacePath);
    }

    this.isReady = true;
  }

  async close(): Promise<void> {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
  }

  async getPage(id: string): Promise<Page | null> {
    const filePath = await this.findPageFile(id);
    if (!filePath) return null;

    return this.readPageFromPath(filePath);
  }

  async readPageFromPath(filePath: string): Promise<Page | null> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const content = await readFileCompat(tauriGooseFs, filePath);
    if (!content) return null;

    return this.parseMarkdown(content, filePath);
  }

  async savePage(page: Page): Promise<void> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const workspaceDir = joinPath(this.workspacePath, page.workspaceId);
    await tauriGooseFs.mkdir(workspaceDir);

    const fileName = generateFileName(page);
    const filePath = joinPath(workspaceDir, fileName);

    const markdown = pageToMarkdown(page);
    await writeFileCompat(tauriGooseFs, filePath, markdown);
  }

  async deletePage(id: string): Promise<void> {
    const filePath = await this.findPageFile(id);
    if (!filePath) return;

    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(filePath);
    } catch (error) {
      console.error("[MarkdownAdapter] Failed to delete file:", error);
    }
  }

  async listPages(workspaceId?: string): Promise<PageMeta[]> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const pages: PageMeta[] = [];
    const targetDir = workspaceId
      ? joinPath(this.workspacePath, workspaceId)
      : this.workspacePath;

    const entries = await readDirCompat(tauriGooseFs, targetDir);

    for (const entry of entries) {
      if (entry.isDirectory) {
        const subEntries = await readDirCompat(tauriGooseFs, entry.path);
        for (const subEntry of subEntries) {
          if (subEntry.name.endsWith(".md")) {
            const page = await this.readPageMeta(subEntry.path);
            if (page) pages.push(page);
          }
        }
      } else if (entry.name.endsWith(".md")) {
        const page = await this.readPageMeta(entry.path);
        if (page) pages.push(page);
      }
    }

    return pages.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async searchPages(query: string): Promise<SearchResult[]> {
    const pages = await this.listPages();
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const pageMeta of pages) {
      const page = await this.getPage(pageMeta.id);
      if (!page) continue;

      const title = extractTitleFromContent(page.content).toLowerCase();
      const content = JSON.stringify(page.content).toLowerCase();

      if (title.includes(lowerQuery) || content.includes(lowerQuery)) {
        results.push({
          pageId: page.id,
          title: extractTitleFromContent(page.content),
          preview: this.extractPreview(page, query),
        });
      }
    }

    return results;
  }

  async saveAttachment(pageId: string, file: File): Promise<string> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const page = await this.getPage(pageId);
    if (!page) throw new Error("Page not found");

    const workspaceDir = joinPath(this.workspacePath, page.workspaceId);
    const assetsDir = joinPath(workspaceDir, "assets");
    await tauriGooseFs.mkdir(assetsDir);

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = joinPath(assetsDir, fileName);

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(filePath, uint8Array);

    return `./assets/${fileName}`;
  }

  async getAttachment(path: string): Promise<Uint8Array | null> {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      return await readFile(path);
    } catch {
      return null;
    }
  }

  async sync(): Promise<void> {
    // Markdown-only mode: nothing to sync
  }

  onFileChange(callback: (change: FileChange) => void): () => void {
    this.fileChangeCallbacks.push(callback);
    return () => {
      const index = this.fileChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.fileChangeCallbacks.splice(index, 1);
      }
    };
  }

  private async findPageFile(id: string): Promise<string | null> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const scanDir = async (dir: string): Promise<string | null> => {
      const entries = await readDirCompat(tauriGooseFs, dir);

      for (const entry of entries) {
        if (entry.isDirectory) {
          const found = await scanDir(entry.path);
          if (found) return found;
        } else if (entry.name.endsWith(".md")) {
          const content = await readFileCompat(tauriGooseFs, entry.path);
          if (content && content.includes(`id: "${id}"`)) {
            return entry.path;
          }
        }
      }

      return null;
    };

    return scanDir(this.workspacePath);
  }

  private async readPageMeta(filePath: string): Promise<PageMeta | null> {
    try {
      const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");
      const content = await readFileCompat(tauriGooseFs, filePath);
      if (!content) return null;

      const page = this.parseMarkdown(content, filePath);
      if (!page) return null;

      return {
        id: page.id,
        workspaceId: page.workspaceId,
        parentId: page.parentId,
        title: extractTitleFromContent(page.content),
        icon: page.icon,
        isFolder: page.isFolder || false,
        isFavorite: page.isFavorite || false,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        filePath,
      };
    } catch {
      return null;
    }
  }

  private parseMarkdown(content: string, filePath: string): Page | null {
    try {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

      if (!frontmatterMatch) {
        return this.createPageFromRawContent(content, filePath);
      }

      const frontmatter = frontmatterMatch[1];
      const body = frontmatterMatch[2];

      const meta: Record<string, unknown> = {};
      frontmatter.split("\n").forEach((line) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, "");
          meta[key] = value;
        }
      });

      const now = Date.now();

      return {
        id: (meta.id as string) || crypto.randomUUID(),
        workspaceId: this.extractWorkspaceId(filePath),
        parentId: meta.parentId as string | undefined,
        icon: meta.icon as string | undefined,
        content: this.markdownToJsonContent(body),
        isFolder: meta.isFolder === "true",
        isFavorite: meta.isFavorite === "true",
        isLocked: false,
        isFullWidth: meta.isFullWidth === "true",
        fontSize: (meta.fontSize as "default" | "small") || "default",
        fontFamily: (meta.fontFamily as "default" | "serif" | "mono") || "default",
        createdAt: meta.createdAt
          ? new Date(meta.createdAt as string).getTime()
          : now,
        updatedAt: meta.updatedAt
          ? new Date(meta.updatedAt as string).getTime()
          : now,
        localFilePath: filePath,
      };
    } catch (error) {
      console.error("[MarkdownAdapter] Failed to parse markdown:", error);
      return null;
    }
  }

  private createPageFromRawContent(content: string, filePath: string): Page {
    return {
      id: crypto.randomUUID(),
      workspaceId: this.extractWorkspaceId(filePath),
      content: this.markdownToJsonContent(content),
      isLocked: false,
      isFullWidth: false,
      fontSize: "default",
      fontFamily: "default",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      localFilePath: filePath,
    };
  }

  private markdownToJsonContent(markdown: string): Record<string, unknown> {
    const lines = markdown.split("\n");
    const content: unknown[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("# ")) {
        content.push({
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: trimmed.slice(2) }],
        });
      } else if (trimmed.startsWith("## ")) {
        content.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: trimmed.slice(3) }],
        });
      } else if (trimmed.startsWith("- ")) {
        content.push({
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: trimmed.slice(2) }],
                },
              ],
            },
          ],
        });
      } else {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: trimmed }],
        });
      }
    }

    return { type: "doc", content };
  }

  private extractWorkspaceId(filePath: string): string {
    const parts = normalizeSlash(filePath).split("/");
    const workspaceIndex = parts.indexOf(this.workspacePath.split("/").pop() || "");
    if (workspaceIndex > -1 && parts[workspaceIndex + 1]) {
      return parts[workspaceIndex + 1];
    }
    return "default";
  }

  private extractPreview(page: Page, query: string): string {
    const content = JSON.stringify(page.content);
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return "";

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    return content.slice(start, end).replace(/[{}"\[\]]/g, "");
  }
}
