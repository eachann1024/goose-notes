import { useSettings } from "@/stores/useSettings";

export const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";
export const TINYFISH_FETCH_URL = "https://api.fetch.tinyfish.ai";
const TINYFISH_TIMEOUT_MS = 16_000;
const TINYFISH_RATE_LIMIT_ROUNDS = 3;
const TINYFISH_RATE_LIMIT_WAIT_MS = 1000;

export const TINYFISH_KEY_MISSING_ERROR =
  "未配置 TinyFish API Key。请到设置 → AI 助手 填写。";
export const TINYFISH_KEY_INVALID_ERROR =
  "TinyFish API Key 无效。请到设置 → AI 助手 检查。";
export const TINYFISH_RATE_LIMIT_ERROR = "联网调用失败，请稍后再试。";

export function errorMessage(error: unknown) {
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

export function readTinyfishKeyPool(): string[] {
  const settingsKey = useSettings.getState().ai.tinyfishApiKey?.trim() ?? "";
  return uniqueNonEmptyKeys([
    settingsKey,
    readViteTinyfishKey("A"),
    readViteTinyfishKey("B"),
  ]);
}

export async function tinyfishJson(
  url: string,
  init: RequestInit,
  outerSignal?: AbortSignal,
): Promise<{ status: number; data: unknown }> {
  const linkedAbort = createLinkedAbortController(
    outerSignal,
    TINYFISH_TIMEOUT_MS,
  );
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
      data = await withTimeout(response.json(), TINYFISH_TIMEOUT_MS, () =>
        linkedAbort.abort(),
      );
    } catch {
      data = null;
    }
    return { status: response.status, data };
  } finally {
    linkedAbort.cleanup();
  }
}

export function tinyfishAuthHeaders(apiKey: string): HeadersInit {
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

export async function withTinyfishKeyRotation(
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
        await defaultRateLimitWait(TINYFISH_RATE_LIMIT_WAIT_MS);
        continue;
      }
      return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
    }
    return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
  }

  return { ok: false, error: TINYFISH_RATE_LIMIT_ERROR };
}
