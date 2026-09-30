import { expect, test } from "playwright/test";
import {
  parseTinyfishFetchResult,
  parseTinyfishSearchResults,
  readWebPage,
  searchWeb,
  setTinyfishBakedEnvKeysForTests,
  setTinyfishRateLimitWaitForTests,
  TINYFISH_KEY_INVALID_ERROR,
  TINYFISH_KEY_MISSING_ERROR,
  TINYFISH_RATE_LIMIT_ERROR,
  tinyfishKeyGuard,
  validateExternalHttpUrl,
} from "../../src/lib/notebook-ai/tools/web";
import { useSettings } from "../../src/stores/useSettings";

test("AI 网页工具只接受公开 HTTP/HTTPS 地址", () => {
  expect(validateExternalHttpUrl("https://example.com/article?q=1")).toBe(
    "https://example.com/article?q=1",
  );

  for (const url of [
    "file:///tmp/secret",
    "http://localhost/admin",
    "http://127.0.0.1/admin",
    "http://192.168.1.1/admin",
    "http://user:password@example.com/",
  ]) {
    expect(() => validateExternalHttpUrl(url)).toThrow();
  }
});

test("未配置 TinyFish Key 时返回明确错误，不发起请求", () => {
  expect(tinyfishKeyGuard("")).toEqual({ error: TINYFISH_KEY_MISSING_ERROR });
  expect(tinyfishKeyGuard("   ")).toEqual({ error: TINYFISH_KEY_MISSING_ERROR });
  expect(tinyfishKeyGuard(undefined)).toEqual({
    error: TINYFISH_KEY_MISSING_ERROR,
  });
  expect(tinyfishKeyGuard("tf-key")).toBeNull();
});

test("TinyFish 搜索结果解析为标题、链接和摘要", () => {
  const payload = {
    query: "rust",
    results: [
      {
        position: 1,
        site_name: "rust-lang.org",
        title: "Rust",
        snippet: "A language",
        url: "https://www.rust-lang.org/",
      },
      {
        position: 2,
        site_name: "example.com",
        title: "  第二条  ",
        snippet: "  摘要  ",
        url: "https://example.com/two",
      },
      { position: 3, title: "", snippet: "skip", url: "https://example.com/skip" },
    ],
    total_results: 3,
    page: 0,
  };

  expect(parseTinyfishSearchResults(payload, 1)).toEqual([
    {
      title: "Rust",
      url: "https://www.rust-lang.org/",
      snippet: "A language",
    },
  ]);
  expect(parseTinyfishSearchResults(payload, 8)).toHaveLength(2);
});

test("TinyFish 读页解析正文或 errors[]", () => {
  expect(
    parseTinyfishFetchResult({
      results: [
        {
          url: "https://example.com",
          final_url: "https://example.com/",
          title: "Example",
          text: "  正文  ",
        },
      ],
      errors: [],
    }),
  ).toEqual({ content: "正文" });

  expect(
    parseTinyfishFetchResult({
      results: [],
      errors: [{ url: "https://example.com", error: "blocked" }],
    }),
  ).toEqual({ error: "blocked" });
});

test("searchWeb 缺 Key 时不访问网络", async () => {
  const previous = useSettings.getState().ai.tinyfishApiKey;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not fetch");
  };
  useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: "" } }));
  try {
    const result = await searchWeb.execute!(
      { query: "rust", maxResults: 5 },
      { toolCallId: "t-missing", messages: [] },
    );
    expect(result).toEqual({ error: TINYFISH_KEY_MISSING_ERROR });
    expect(fetchCalled).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
    useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: previous } }));
  }
});

test("searchWeb 只请求 TinyFish 并映射结果", async () => {
  const previous = useSettings.getState().ai.tinyfishApiKey;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  globalThis.fetch = async (input, init) => {
    const headers = Object.fromEntries(
      new Headers(init?.headers).entries(),
    ) as Record<string, string>;
    calls.push({ url: String(input), headers });
    return new Response(
      JSON.stringify({
        query: "rust",
        results: [
          {
            position: 1,
            site_name: "rust-lang.org",
            title: "Rust",
            snippet: "A language",
            url: "https://www.rust-lang.org/",
          },
        ],
        total_results: 1,
        page: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: " tf-test-key " } }));
  try {
    const result = await searchWeb.execute!(
      { query: "rust", maxResults: 5 },
      { toolCallId: "t-search", messages: [] },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("https://api.search.tinyfish.ai");
    expect(calls[0].url).toContain("query=rust");
    expect(calls[0].headers["x-api-key"]).toBe("tf-test-key");
    expect(result).toEqual({
      source: "TinyFish",
      query: "rust",
      results: [
        {
          title: "Rust",
          url: "https://www.rust-lang.org/",
          snippet: "A language",
        },
      ],
      untrustedExternalContent: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: previous } }));
  }
});

test("readWebPage 401 提示 Key 无效", async () => {
  const previous = useSettings.getState().ai.tinyfishApiKey;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: "tf-bad" } }));
  try {
    const result = await readWebPage.execute!(
      { url: "https://example.com/article" },
      { toolCallId: "t-401", messages: [] },
    );
    expect(result).toEqual({ error: TINYFISH_KEY_INVALID_ERROR });
  } finally {
    globalThis.fetch = originalFetch;
    useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: previous } }));
  }
});

test("searchWeb 首个 Key 429 后立刻换下一个 Key", async () => {
  const previous = useSettings.getState().ai.tinyfishApiKey;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  globalThis.fetch = async (input, init) => {
    const headers = Object.fromEntries(
      new Headers(init?.headers).entries(),
    ) as Record<string, string>;
    calls.push({ url: String(input), headers });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
      });
    }
    return new Response(
      JSON.stringify({
        query: "rust",
        results: [
          {
            position: 1,
            site_name: "rust-lang.org",
            title: "Rust",
            snippet: "A language",
            url: "https://www.rust-lang.org/",
          },
        ],
        total_results: 1,
        page: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: "" } }));
  setTinyfishBakedEnvKeysForTests({ a: "tf-key-a", b: "tf-key-b" });
  try {
    const result = await searchWeb.execute!(
      { query: "rust", maxResults: 5 },
      { toolCallId: "t-rotate-429", messages: [] },
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].headers["x-api-key"]).toBe("tf-key-a");
    expect(calls[1].headers["x-api-key"]).toBe("tf-key-b");
    expect(result).toEqual({
      source: "TinyFish",
      query: "rust",
      results: [
        {
          title: "Rust",
          url: "https://www.rust-lang.org/",
          snippet: "A language",
        },
      ],
      untrustedExternalContent: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: previous } }));
    setTinyfishBakedEnvKeysForTests(null);
  }
});

test("searchWeb 全部 Key 连续 3 轮 429 后返回限流错误", async () => {
  const previous = useSettings.getState().ai.tinyfishApiKey;
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let waitCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429,
    });
  };
  useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: "" } }));
  setTinyfishBakedEnvKeysForTests({ a: "tf-key-a", b: "tf-key-b" });
  setTinyfishRateLimitWaitForTests(async () => {
    waitCount += 1;
  });
  try {
    const result = await searchWeb.execute!(
      { query: "rust", maxResults: 5 },
      { toolCallId: "t-rate-limit", messages: [] },
    );
    expect(result).toEqual({ error: TINYFISH_RATE_LIMIT_ERROR });
    expect(fetchCount).toBe(6);
    expect(waitCount).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
    useSettings.setState((state) => ({ ai: { ...state.ai, tinyfishApiKey: previous } }));
    setTinyfishBakedEnvKeysForTests(null);
    setTinyfishRateLimitWaitForTests(null);
  }
});
