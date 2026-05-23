import {
  importFromMarkdown,
  jsonContentToMarkdown,
} from "@/lib/export";
import { normalizePageContent } from "@/lib/blocknote-content";

// blockHash -> 该块对应的磁盘原文 markdown 片段
type SourceMap = Map<string, string>;

const blockSourceMaps = new Map<string, SourceMap>();

function stripVolatileKeys(node: any): any {
  if (Array.isArray(node)) return node.map(stripVolatileKeys);
  if (node && typeof node === "object") {
    const out: Record<string, any> = {};
    const keys = Object.keys(node).sort();
    for (const key of keys) {
      if (key === "id") continue;
      out[key] = stripVolatileKeys(node[key]);
    }
    return out;
  }
  return node;
}

export function hashBlock(block: any): string {
  return JSON.stringify(stripVolatileKeys(block));
}

// 把 markdown 拆成顶级块字符串，保持代码围栏块原子。
export function splitMarkdownIntoBlocks(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  const flush = () => {
    if (current.length > 0) {
      const joined = current.join("\n");
      if (joined.trim().length > 0) blocks.push(joined);
      current = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence) {
      const fenceMatch = trimmed.match(/^(```+|~~~+)/);
      if (fenceMatch) {
        // 代码块开始：刷新前面累积块，进入 fence 状态
        if (current.length > 0 && current.some((l) => l.trim().length > 0)) {
          flush();
        }
        inFence = true;
        fenceMarker = fenceMatch[1];
        current.push(line);
        continue;
      }
      if (trimmed === "") {
        flush();
        continue;
      }
      current.push(line);
    } else {
      current.push(line);
      if (trimmed.startsWith(fenceMarker)) {
        inFence = false;
        flush();
      }
    }
  }
  flush();
  return blocks;
}

function extractTopLevelBlocks(content: any): any[] {
  if (Array.isArray(content)) return content;
  if (content && content.type === "doc" && Array.isArray(content.content)) {
    return content.content;
  }
  return [];
}

// 为某个 page 建立 blockHash -> 原文 markdown 的映射。
export function setBlockSourceMap(pageId: string, rawMarkdown: string) {
  const map: SourceMap = new Map();
  const chunks = splitMarkdownIntoBlocks(rawMarkdown);

  for (const chunk of chunks) {
    const imported = importFromMarkdown(chunk, "");
    if (!imported.success) continue;
    const blocks = extractTopLevelBlocks(
      normalizePageContent(imported.content as any),
    );
    if (blocks.length === 0) continue;
    // 一个 markdown 片段可能解析成多个 BlockNote 顶级块；把这些块的合并 hash 也记一下，
    // 同时给每个块单独记录其归属的整片段，便于 1:1 命中。
    const combinedHash = hashBlock(blocks);
    if (!map.has(combinedHash)) map.set(combinedHash, chunk);
    for (const b of blocks) {
      const h = hashBlock(b);
      if (!map.has(h)) map.set(h, chunkToSingleBlockMarkdown(chunk, blocks, b));
    }
  }

  blockSourceMaps.set(pageId, map);
}

function chunkToSingleBlockMarkdown(
  chunk: string,
  allBlocksInChunk: any[],
  targetBlock: any,
): string {
  // 当一个 markdown 片段只解析出一个块时，整段直接归属该块。
  if (allBlocksInChunk.length <= 1) return chunk;
  // 多个块时，回退到对该块单独序列化（保留性较弱，但仍是最优可达）。
  try {
    return jsonContentToMarkdown([targetBlock] as any);
  } catch {
    return chunk;
  }
}

export function clearBlockSourceMap(pageId: string) {
  blockSourceMaps.delete(pageId);
}

// 用 source map 把编辑器内容序列化为 markdown：未变更块直接用磁盘原文。
export function serializeWithBlockDiff(
  pageId: string,
  content: any,
): string {
  const map = blockSourceMaps.get(pageId);
  const blocks = extractTopLevelBlocks(content);

  if (!map || map.size === 0 || blocks.length === 0) {
    return jsonContentToMarkdown(content);
  }

  const chunks: string[] = [];
  for (const block of blocks) {
    const h = hashBlock(block);
    const orig = map.get(h);
    if (orig !== undefined) {
      chunks.push(orig);
    } else {
      let fresh = "";
      try {
        fresh = jsonContentToMarkdown([block] as any);
      } catch {
        fresh = "";
      }
      chunks.push(fresh);
    }
  }
  return chunks.filter((c) => c.length > 0).join("\n\n");
}
