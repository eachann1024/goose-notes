/**
 * 全局搜索倒排索引 —— 模块级单例，不进 zustand store
 *
 * 中文分词策略：
 *   - 每个 CJK 字符单独作为 token（索引 + 搜索时相同处理）
 *   - 非 CJK 段落按空格/标点切分
 *   - 搜索时 prefix: true，使「笔」能命中「笔记」
 *   - 同时保留 fuzzy: 0.1 兜底英文拼写容错，但中文基本靠 prefix 覆盖
 */
import MiniSearch from "minisearch";
import type { Page } from "@/types";
import {
  getPageTitle,
  UNTITLED_PAGE_TITLE,
} from "@/components/editor/utils/page-title";
import { extractTextFromContent } from "@/components/editor/utils/content-text-extractor";

function isPlaceholderTitle(title: string): boolean {
  return title === UNTITLED_PAGE_TITLE || title === "无标题";
}

function bodyForSearchIndex(page: Page, title: string): string {
  const body = extractTextFromContent(page.content);
  if (!isPlaceholderTitle(title)) return body;
  return body.replace(/^(?:未命名|无标题)\s*/, "").trim();
}

// ——— 中文分词 ———

/** 将文本拆成 token：CJK 字逐一分出，其余按空白/标点切割 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // 匹配一个 CJK 字符，或者一段非 CJK 的连续字母/数字
  const re = /[一-鿿㐀-䶿豈-﫿぀-ヿ]|[^\s一-鿿㐀-䶿豈-﫿぀-ヿ]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (t) tokens.push(t);
  }
  return tokens;
}

// ——— MiniSearch 单例 ———

interface IndexDoc {
  id: string;
  title: string;
  body: string;
}

let miniSearch: MiniSearch<IndexDoc> | null = null;

/** key=pageId：用 updatedAt + content 引用判断是否需要重新抽文本 */
const indexedVersions = new Map<
  string,
  { updatedAt: number; content: Page["content"] }
>();

function getInstance(): MiniSearch<IndexDoc> {
  if (!miniSearch) {
    miniSearch = new MiniSearch<IndexDoc>({
      fields: ["title", "body"],
      storeFields: ["id"],
      tokenize,
      searchOptions: {
        tokenize,
        prefix: true,
        boost: { title: 2 },
        fuzzy: 0.1,
      },
    });
  }
  return miniSearch;
}

// ——— 公开 API ———

/**
 * 增量同步索引：
 * - 已删除的页从索引移除
 * - updatedAt 变了的页重新索引
 * - 新增页加入
 *
 * @param pages 当前全量 pages map（含已筛好的范围）
 */
export function syncIndex(pages: Record<string, Page>): void {
  const ms = getInstance();
  const pageIds = new Set(Object.keys(pages));

  // 1. 移除已删除/不在范围内的页
  for (const [id] of indexedVersions) {
    if (!pageIds.has(id)) {
      try { ms.discard(id); } catch { /* ignore */ }
      indexedVersions.delete(id);
    }
  }

  // 2. 新增 / 更新
  const toAdd: IndexDoc[] = [];
  const toUpdate: IndexDoc[] = [];

  for (const page of Object.values(pages)) {
    const current = indexedVersions.get(page.id);
    if (
      current &&
      current.updatedAt === page.updatedAt &&
      current.content === page.content
    ) {
      continue;
    }

    const title = getPageTitle(page);
    const body = bodyForSearchIndex(page, title);
    const doc: IndexDoc = {
      id: page.id,
      title: isPlaceholderTitle(title) ? "" : title,
      body,
    };

    if (current === undefined) {
      toAdd.push(doc);
    } else {
      toUpdate.push(doc);
    }
    indexedVersions.set(page.id, {
      updatedAt: page.updatedAt,
      content: page.content,
    });
  }

  if (toAdd.length > 0) ms.addAll(toAdd);
  for (const doc of toUpdate) {
    try {
      // replace 原子替换（MiniSearch 7.x 支持），比 discard+add 更安全
      ms.replace(doc);
    } catch {
      // replace 不存在时降级：确保 id 不重复再 add
      try { ms.discard(doc.id); } catch { /* ignore */ }
      try { ms.add(doc); } catch { /* ignore */ }
    }
  }
}

/**
 * 全文搜索，返回按 MiniSearch 分数排序的 page id 列表
 * prefix 已在 searchOptions 中默认开启
 */
export function searchIndex(query: string): string[] {
  if (!miniSearch) return [];
  const results = miniSearch.search(query);
  return results.map((r) => r.id as string);
}

/** 重置索引（切换笔记本时调用，可选） */
export function resetIndex(): void {
  miniSearch = null;
  indexedVersions.clear();
}
