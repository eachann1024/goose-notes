const MAX_TOOL_CONTENT = 48_000;

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
  const isPrivateIpv4 =
    /^(?:0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(
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
