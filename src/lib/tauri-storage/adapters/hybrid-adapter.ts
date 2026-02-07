import type { Page } from "@/types";
import type {
  FileChange,
  PageMeta,
  SearchResult,
  StorageAdapter,
  StorageSettings,
} from "../types";
import { MarkdownStorageAdapter } from "./markdown-adapter";
import { SQLiteAdapter } from "./sqlite-adapter";

export class HybridStorageAdapter implements StorageAdapter {
  readonly mode = "hybrid";
  isReady = false;

  private markdownAdapter: MarkdownStorageAdapter;
  private sqliteAdapter: SQLiteAdapter;
  private settings: StorageSettings;
  private fileChangeCallbacks: ((change: FileChange) => void)[] = [];

  constructor(settings: StorageSettings) {
    this.settings = settings;
    this.markdownAdapter = new MarkdownStorageAdapter(settings);
    this.sqliteAdapter = new SQLiteAdapter(settings);
  }

  async initialize(): Promise<void> {
    await this.markdownAdapter.initialize();
    await this.sqliteAdapter.initialize();

    const needsReindex = await this.checkIndexConsistency();
    if (needsReindex) {
      await this.rebuildIndex();
    }

    this.isReady = true;
  }

  async close(): Promise<void> {
    await this.markdownAdapter.close();
    await this.sqliteAdapter.close();
    this.isReady = false;
  }

  async getPage(id: string): Promise<Page | null> {
    const meta = await this.sqliteAdapter.getPage(id);
    if (meta?.filePath) {
      const page = await this.markdownAdapter.readPageFromPath(meta.filePath);
      if (page) return page;
    }

    return this.markdownAdapter.getPage(id);
  }

  async savePage(page: Page): Promise<void> {
    await this.markdownAdapter.savePage(page);

    const filePath = await this.findPageFilePath(page.id);
    if (filePath) {
      await this.sqliteAdapter.indexPage(page, filePath);
    }
  }

  async deletePage(id: string): Promise<void> {
    await this.markdownAdapter.deletePage(id);
    await this.sqliteAdapter.removePage(id);
  }

  async listPages(workspaceId?: string): Promise<PageMeta[]> {
    return this.sqliteAdapter.listPageMeta(workspaceId);
  }

  async searchPages(query: string): Promise<SearchResult[]> {
    return this.sqliteAdapter.searchPages(query);
  }

  async saveAttachment(pageId: string, file: File): Promise<string> {
    return this.markdownAdapter.saveAttachment(pageId, file);
  }

  async getAttachment(path: string): Promise<Uint8Array | null> {
    return this.markdownAdapter.getAttachment(path);
  }

  async sync(): Promise<void> {
    await this.rebuildIndex();
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

  async rebuildIndex(): Promise<void> {
    const pages = await this.markdownAdapter.listPages();

    await this.sqliteAdapter.transaction(async (adapter) => {
      for (const pageMeta of pages) {
        const page = await this.markdownAdapter.getPage(pageMeta.id);
        if (page) {
          await adapter.indexPage(page, pageMeta.filePath);
        }
      }
    });

    if (this.settings.searchIndexEnabled) {
      await this.sqliteAdapter.rebuildSearchIndex();
    }
  }

  private async checkIndexConsistency(): Promise<boolean> {
    try {
      const mdPages = await this.markdownAdapter.listPages();
      const indexedPages = await this.sqliteAdapter.listPageMeta();

      if (mdPages.length !== indexedPages.length) {
        return true;
      }

      const indexedIds = new Set(indexedPages.map((p) => p.id));
      const hasMissing = mdPages.some((p) => !indexedIds.has(p.id));

      return hasMissing;
    } catch {
      return true;
    }
  }

  private async findPageFilePath(id: string): Promise<string | null> {
    const meta = await this.sqliteAdapter.getPage(id);
    if (meta?.filePath) return meta.filePath;

    const pages = await this.markdownAdapter.listPages();
    const page = pages.find((p) => p.id === id);
    return page?.filePath || null;
  }
}
