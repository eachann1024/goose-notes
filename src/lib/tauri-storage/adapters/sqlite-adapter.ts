import Database from "@tauri-apps/plugin-sql";
import type { Page } from "@/types";
import type {
  PageMeta,
  SearchResult,
  StorageSettings,
} from "../types";
import { extractTitleFromContent, joinPath } from "../utils";

export class SQLiteAdapter {
  private db: Database | null = null;
  private dbPath: string;
  private settings: StorageSettings;

  constructor(settings: StorageSettings) {
    this.settings = settings;
    this.dbPath = joinPath(joinPath(settings.workspacePath, ".goose"), "index.db");
  }

  async initialize(): Promise<void> {
    const { tauriGooseFs } = await import("@/lib/host/tauri-goose-fs");

    const gooseDir = joinPath(this.settings.workspacePath, ".goose");
    await tauriGooseFs.mkdir(gooseDir);

    this.db = await Database.load(`sqlite:${this.dbPath}`);
    await this.migrate();
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async indexPage(page: Page, filePath?: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const title = extractTitleFromContent(page.content);

    await this.db.execute(
      `INSERT OR REPLACE INTO pages 
       (id, workspace_id, parent_id, title, file_path, icon, 
        is_folder, is_favorite, is_full_width, font_family,
        created_at, updated_at, sort_order, content_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        page.id,
        page.workspaceId,
        page.parentId || null,
        title,
        filePath || page.localFilePath || null,
        page.icon || null,
        page.isFolder ? 1 : 0,
        page.isFavorite ? 1 : 0,
        page.isFullWidth ? 1 : 0,
        page.fontFamily,
        page.createdAt,
        page.updatedAt,
        page.order || 0,
        this.extractContentPreview(page),
      ]
    );

    if (this.settings.searchIndexEnabled) {
      await this.updateFTS(page, title);
    }
  }

  async removePage(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execute("DELETE FROM pages WHERE id = $1", [id]);

    if (this.settings.searchIndexEnabled) {
      await this.db.execute("DELETE FROM pages_fts WHERE rowid = (SELECT rowid FROM pages WHERE id = $1)", [id]);
    }
  }

  async removePageByPath(filePath: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execute("DELETE FROM pages WHERE file_path = $1", [filePath]);
  }

  async getPage(id: string): Promise<PageMeta | null> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.select<PageMeta[]>(
      `SELECT 
        id, workspace_id as workspaceId, parent_id as parentId,
        title, file_path as filePath, icon,
        is_folder as isFolder, is_favorite as isFavorite,
        created_at as createdAt, updated_at as updatedAt
       FROM pages WHERE id = $1`,
      [id]
    );

    return result[0] || null;
  }

  async listPageMeta(workspaceId?: string): Promise<PageMeta[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = `
      SELECT 
        id, workspace_id as workspaceId, parent_id as parentId,
        title, file_path as filePath, icon,
        is_folder as isFolder, is_favorite as isFavorite,
        created_at as createdAt, updated_at as updatedAt
      FROM pages 
      WHERE trashed_at IS NULL
    `;

    const params: unknown[] = [];

    if (workspaceId) {
      query += " AND workspace_id = $1";
      params.push(workspaceId);
    }

    query += " ORDER BY updated_at DESC";

    return await this.db.select<PageMeta[]>(query, params);
  }

  async searchPages(query: string): Promise<SearchResult[]> {
    if (!this.db) throw new Error("Database not initialized");

    if (!this.settings.searchIndexEnabled) {
      return this.fallbackSearch(query);
    }

    try {
      const results = await this.db.select<SearchResult[]>(
        `SELECT 
          p.id as pageId,
          p.title,
          snippet(pages_fts, 2, '<mark>', '</mark>', '...', 32) as preview
         FROM pages_fts
         JOIN pages p ON pages_fts.rowid = p.rowid
         WHERE pages_fts MATCH $1
         ORDER BY rank
         LIMIT 50`,
        [query]
      );

      return results;
    } catch {
      return this.fallbackSearch(query);
    }
  }

  async rebuildSearchIndex(): Promise<void> {
    if (!this.db || !this.settings.searchIndexEnabled) return;

    await this.db.execute("DELETE FROM pages_fts");

    const pages = await this.db.select<{ id: string; title: string; content_preview: string }[]>(
      "SELECT id, title, content_preview FROM pages"
    );

    for (const page of pages) {
      await this.db.execute(
        "INSERT INTO pages_fts(rowid, title, content) VALUES ((SELECT rowid FROM pages WHERE id = $1), $2, $3)",
        [page.id, page.title, page.content_preview]
      );
    }
  }

  async transaction<T>(fn: (adapter: SQLiteAdapter) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execute("BEGIN TRANSACTION");
    try {
      const result = await fn(this);
      await this.db.execute("COMMIT");
      return result;
    } catch (error) {
      await this.db.execute("ROLLBACK");
      throw error;
    }
  }

  private async migrate(): Promise<void> {
    if (!this.db) return;

    const version = await this.getVersion();

    if (version < 1) {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          parent_id TEXT,
          title TEXT,
          file_path TEXT,
          icon TEXT,
          is_folder INTEGER DEFAULT 0,
          is_favorite INTEGER DEFAULT 0,
          is_full_width INTEGER DEFAULT 0,
          font_family TEXT DEFAULT 'default',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          trashed_at INTEGER,
          sort_order REAL DEFAULT 0,
          content_preview TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_pages_workspace ON pages(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
        CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at DESC);

        CREATE TABLE IF NOT EXISTS schema_version (version INTEGER);
        INSERT INTO schema_version VALUES (1);
      `);

      if (this.settings.searchIndexEnabled) {
        await this.db.execute(`
          CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
            title,
            content,
            content_rowid=rowid,
            content=pages
          );
        `);
      }
    }
  }

  private async getVersion(): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.db.select<{ version: number }[]>(
        "SELECT version FROM schema_version LIMIT 1"
      );
      return result[0]?.version || 0;
    } catch {
      return 0;
    }
  }

  private async updateFTS(page: Page, title: string): Promise<void> {
    if (!this.db) return;

    const preview = this.extractContentPreview(page);

    await this.db.execute(
      `INSERT OR REPLACE INTO pages_fts(rowid, title, content) 
       VALUES ((SELECT rowid FROM pages WHERE id = $1), $2, $3)`,
      [page.id, title, preview]
    );
  }

  private async fallbackSearch(query: string): Promise<SearchResult[]> {
    if (!this.db) return [];

    const results = await this.db.select<SearchResult[]>(
      `SELECT 
        id as pageId,
        title,
        content_preview as preview
       FROM pages 
       WHERE title LIKE $1 OR content_preview LIKE $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [`%${query}%`]
    );

    return results;
  }

  private extractContentPreview(page: Page): string {
    try {
      const content = page.content;
      if (!content || !content.content) return "";

      const extractText = (node: unknown): string => {
        if (typeof node !== "object" || node === null) return "";

        const n = node as Record<string, unknown>;

        if (typeof n.text === "string") return n.text;

        if (Array.isArray(n.content)) {
          return n.content.map(extractText).join(" ");
        }

        return "";
      };

      const text = extractText(content);
      return text.slice(0, 1000);
    } catch {
      return "";
    }
  }
}
