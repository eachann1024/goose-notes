import { tool } from "ai";
import { z } from "zod";
import {
  TINYFISH_SEARCH_URL,
  TINYFISH_FETCH_URL,
  TINYFISH_KEY_MISSING_ERROR,
  errorMessage,
  readTinyfishKeyPool,
  tinyfishJson,
  tinyfishAuthHeaders,
  withTinyfishKeyRotation,
} from "./webTransport";
import {
  validateExternalHttpUrl,
  parseTinyfishSearchResults,
  parseTinyfishFetchResult,
} from "./webResults";
export {
  TINYFISH_KEY_MISSING_ERROR,
  TINYFISH_KEY_INVALID_ERROR,
  TINYFISH_RATE_LIMIT_ERROR,
  tinyfishKeyGuard,
} from "./webTransport";
export {
  validateExternalHttpUrl,
  parseTinyfishSearchResults,
  parseTinyfishFetchResult,
  type TinyfishSearchHit,
} from "./webResults";

export const searchWeb = tool({
  description:
    "联网搜索，返回标题、摘要和来源链接。仅在用户本轮明确要求联网，或本轮问题明确需要外部事实且已有上下文不够时调用。",
  inputSchema: z.object({
    query: z.string().min(1).describe("用自然语言描述希望找到的网页或信息"),
    maxResults: z.number().int().min(1).max(8).optional().default(5),
  }),
  execute: async (input, options) => {
    const outcome = await withTinyfishKeyRotation((apiKey) =>
      tinyfishJson(
        `${TINYFISH_SEARCH_URL}?query=${encodeURIComponent(input.query)}`,
        {
          method: "GET",
          headers: tinyfishAuthHeaders(apiKey),
        },
        options.abortSignal,
      ),
    );
    if (!outcome.ok) return { error: outcome.error };
    try {
      return {
        source: "TinyFish",
        query: input.query,
        results: parseTinyfishSearchResults(outcome.data, input.maxResults),
        untrustedExternalContent: true,
      };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  },
});

export const readWebPage = tool({
  description:
    "读取一个已知网页 URL 的正文并返回可供大模型使用的文本。看到用户给出的链接且任务依赖链接内容时调用，不能只根据 URL 猜测内容。",
  inputSchema: z.object({
    url: z.string().min(1).describe("要读取的完整 HTTP 或 HTTPS 网址"),
  }),
  execute: async (input, options) => {
    const pool = readTinyfishKeyPool();
    if (pool.length === 0) {
      return { error: TINYFISH_KEY_MISSING_ERROR };
    }

    let url: string;
    try {
      url = validateExternalHttpUrl(input.url);
    } catch (error) {
      return { error: errorMessage(error) };
    }

    const outcome = await withTinyfishKeyRotation((apiKey) =>
      tinyfishJson(
        TINYFISH_FETCH_URL,
        {
          method: "POST",
          headers: {
            ...tinyfishAuthHeaders(apiKey),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ urls: [url], format: "markdown" }),
        },
        options.abortSignal,
      ),
    );
    if (!outcome.ok) return { error: outcome.error };
    try {
      const parsed = parseTinyfishFetchResult(outcome.data);
      if (parsed.error) return { error: parsed.error };
      return {
        source: "TinyFish",
        url,
        content: parsed.content ?? "",
        untrustedExternalContent: true,
      };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  },
});
