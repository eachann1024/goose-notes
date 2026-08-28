import { tool } from "ai";
import { z } from "zod";
import { useSettings } from "@/stores/useSettings";

const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";
const TINYFISH_FETCH_URL = "https://api.fetch.tinyfish.ai";
const TINYFISH_TIMEOUT_MS = 16_000;
const MAX_TOOL_CONTENT = 48_000;
const TINYFISH_RATE_LIMIT_ROUNDS = 3;
const TINYFISH_RATE_LIMIT_WAIT_MS = 1000;

export const TINYFISH_KEY_MISSING_ERROR =
  "未配置 TinyFish API Key。请到设置 → AI 助手 填写。";
export const TINYFISH_KEY_INVALID_ERROR =
  "TinyFish API Key 无效。请到设置 → AI 助手 检查。";
export const TINYFISH_RATE_LIMIT_ERROR = "联网调用失败，请稍后再试。";

export type TinyfishSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

function truncateContent(text: string, max = MAX_TOOL_CONTENT) {
  const normalized = text.trim();
  return normalized.length > max
    ? `${normalized.slice(0, max)}\n\n[内容过长，已截断]`
    : normalized;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "联网服务暂不可用";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error("联网请求超时"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createLinkedAbortController(
  outerSignal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const abortFromOuter = () => controller.abort(outerSignal?.reason);
  if (outerSignal?.aborted) {
    abortFromOuter();
  } else {
    outerSignal?.addEventListener("abort", abortFromOuter, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    cleanup: () => {
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", abortFromOuter);
    },
  };
}

export function tinyfishKeyGuard(key: string | undefined | null) {
  if (typeof key === "string" && key.trim()) return null;
  return { error: TINYFISH_KEY_MISSING_ERROR };
}

const defaultRateLimitWait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

let rateLimitWait = defaultRateLimitWait;
let bakedEnvKeysForTests: { a?: string; b?: string } | null = null;

/** 仅测试使用：注入 429 整池重试等待，避免单测真睡 1 秒。 */
export function setTinyfishRateLimitWaitForTests(
  wait: ((ms: number) => Promise<void>) | null,
) {
  rateLimitWait = wait ?? defaultRateLimitWait;
}

/** 仅测试使用：注入打包 key，避免单测依赖 Vite 环境变量。 */
export function setTinyfishBakedEnvKeysForTests(
  keys: { a?: string; b?: string } | null,
) {
  bakedEnvKeysForTests = keys;
}

function uniqueNonEmptyKeys(keys: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const raw of keys) {
    const key = typeof raw === "string" ? raw.trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push(key);
  }
  return pool;
}

function readViteTinyfishKey(slot: "A" | "B"): string {
  if (bakedEnvKeysForTests) {
    const raw = slot === "A" ? bakedEnvKeysForTests.a : bakedEnvKeysForTests.b;
    return typeof raw === "string" ? raw.trim() : "";
  }
  try {
    // 完整成员访问，供 Vite 构建期替换为打包内置 key。
    const raw =
      slot === "A"
        ? import.meta.env.VITE_TINYFISH_API_KEY_A
        : import.meta.env.VITE_TINYFISH_API_KEY_B;
    return typeof raw === "string" ? raw.trim() : "";
  } catch {
    return "";
  }
}

function readTinyfishKeyPool(): string[] {
  const settingsKey = useSettings.getState().ai.tinyfishApiKey?.trim() ?? "";
  return uniqueNonEmptyKeys([
    settingsKey,
    readViteTinyfishKey("A"),
    readViteTinyfishKey("B"),
  ]);
}

export function validateExternalHttpUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("网址格式不正确");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("只允许读取 HTTP 或 HTTPS 网页");
  }
  if (parsed.username || parsed.password) {
    throw new Error("网址不能包含账号或密码");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const isPrivateIpv4 = /^(?:0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(
    hostname,
  );
  const isPrivateIpv6 =
    hostname === "::" ||
    hostname === "::1" ||
    /^(?:fc|fd|fe[89ab])/i.test(hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    !hostname.includes(".") ||
    isPrivateIpv4 ||
    isPrivateIpv6
  ) {
    throw new Error("不能读取本机或内网地址");
  }

  return parsed.toString();
}

export function parseTinyfishSearchResults(
  payload: unknown,
  maxResults = 5,
): TinyfishSearchHit[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("TinyFish 没有返回可读取内容");
  }
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new Error("TinyFish 没有返回可读取内容");
  }

  const limit = Math.max(1, Math.min(8, maxResults));
  return results
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const url = typeof record.url === "string" ? record.url.trim() : "";
      const snippet =
        typeof record.snippet === "string" ? record.snippet.trim() : "";
      if (!title || !url) return null;
      return { title, url, snippet };
    })
    .filter((item): item is TinyfishSearchHit => item !== null)
    .slice(0, limit);
}

export function parseTinyfishFetchResult(payload: unknown): {
  content?: string;
  error?: string;
} {
  if (!payload || typeof payload !== "object") {
    return { error: "TinyFish 没有返回网页正文" };
  }

  const record = payload as { results?: unknown; errors?: unknown };
  const results = Array.isArray(record.results) ? record.results : [];
  const first = results[0];
  if (first && typeof first === "object") {
    const text = (first as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) {
      return { content: truncateContent(text) };
    }
  }

  const errors = Array.isArray(record.errors) ? record.errors : [];
  const firstError = errors[0];
  if (firstError && typeof firstError === "object") {
    const message = (firstError as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return { error: message.trim() };
    }
  }

  return { error: "TinyFish 没有返回网页正文" };
}

async function tinyfishJson(
  url: string,
  init: RequestInit,
  outerSignal?: AbortSignal,
): Promise<{ status: number; data: unknown }> {
  const linkedAbort = createLinkedAbortController(outerSignal, TINYFISH_TIMEOUT_MS);
  try {
    const response = await withTimeout(
      globalThis.fetch(url, {
        ...init,
        signal: linkedAbort.signal,
      }),
      TINYFISH_TIMEOUT_MS,
      () => linkedAbort.abort(),
    );
    let data: unknown = null;
    try {
      data = await withTimeout(
        response.json(),
        TINYFISH_TIMEOUT_MS,
        () => linkedAbort.abort(),
      );
    } catch {
      data = null;
    }
    return { status: response.status, data };
  } finally {
    linkedAbort.cleanup();
  }
}

function tinyfishAuthHeaders(apiKey: string): HeadersInit {
  return {
    "X-API-Key": apiKey,
    Accept: "application/json",
  };
}

function statusError(status: number) {
  if (status === 401 || status === 403) {
    return { error: TINYFISH_KEY_INVALID_ERROR };
  }
  return { error: `TinyFish 请求失败（HTTP ${status}）` };
}

type TinyfishRotationOk = { ok: true; data: unknown };
type TinyfishRotationErr = { ok: false; error: string };

async function withTinyfishKeyRotation(
  request: (apiKey: string) => Promise<{ status: number; data: unknown }>,
): Promise<TinyfishRotationOk | TinyfishRotationErr> {
  const pool = readTinyfishKeyPool();
  if (pool.length === 0) {
    return { ok: false, error: TINYFISH_KEY_MISSING_ERROR };
  }

  for (let round = 1; round <= TINYFISH_RATE_LIMIT_ROUNDS; round += 1) {
    let all429 = true;
    let allAuth = true;

    for (const apiKey of pool) {
      let status: number;
      let data: unknown;
      try {
        const result = await request(apiKey);
        status = result.status;
        data = result.data;
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }

      if (status === 429) {
        allAuth = false;
        continue;
      }
      if (status === 401 || status === 403) {
        all429 = false;
        continue;
      }
      if (!status || status >= 400) {
        return { ok: false, error: statusError(status).error };
      }
      return { ok: true, data };
    }

    if (allAuth) {
      return { ok: false, error: TINYFISH_KEY_INVALID_ERROR };
    }
    if (all429) {
      if (round < TINYFISH_RATE_LIMIT_ROUNDS) {
        await rateLimitWait(TINYFISH_RATE_LIMIT_WAIT_MS);
        continue;
      }
      return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
    }
    return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
  }

  return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
}

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
