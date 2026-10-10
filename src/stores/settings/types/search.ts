export interface SearchProvider {
  id: string;
  name: string;
  urlTemplate: string;
  isEnabled: boolean;
  isCustom?: boolean;
}

export const DEFAULT_SEARCH_PROVIDERS: SearchProvider[] = [
  {
    id: "baidu",
    name: "百度",
    urlTemplate: "https://www.baidu.com/s?wd=%s",
    isEnabled: true,
  },
  {
    id: "google",
    name: "Google",
    urlTemplate: "https://www.google.com/search?q=%s",
    isEnabled: false,
  },
  {
    id: "quark",
    name: "夸克",
    urlTemplate: "https://ai.quark.cn/s?q=%s",
    isEnabled: true,
  },
  {
    id: "xiaohongshu",
    name: "小红书",
    urlTemplate: "https://www.xiaohongshu.com/search_result?keyword=%s",
    isEnabled: true,
  },
  {
    id: "bilibili",
    name: "哔哩哔哩",
    urlTemplate: "https://search.bilibili.com/all?keyword=%s",
    isEnabled: false,
  },
  {
    id: "douyin",
    name: "抖音",
    urlTemplate: "https://www.douyin.com/search/%s",
    isEnabled: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    urlTemplate: "https://www.perplexity.ai/search?q=%s",
    isEnabled: false,
  },
  {
    id: "bing",
    name: "Bing",
    urlTemplate: "https://www.bing.com/search?q=%s",
    isEnabled: false,
  },
  {
    id: "metaso",
    name: "秘塔",
    urlTemplate: "https://metaso.cn/?q=%s",
    isEnabled: false,
  },
];

export function mergeSearchProvidersWithDefaults(
  searchProviders: SearchProvider[] | undefined,
): SearchProvider[] {
  if (!searchProviders || searchProviders.length === 0) {
    return DEFAULT_SEARCH_PROVIDERS;
  }

  const defaultMap = new Map(
    DEFAULT_SEARCH_PROVIDERS.map((provider) => [provider.id, provider]),
  );
  const merged: SearchProvider[] = [];
  const seenIds = new Set<string>();

  searchProviders.forEach((provider) => {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.id !== "string"
    )
      return;

    const id = provider.id.trim();
    if (!id || seenIds.has(id)) return;

    const defaultProvider = defaultMap.get(id);
    if (defaultProvider) {
      merged.push({
        ...defaultProvider,
        isEnabled: Boolean(provider.isEnabled),
      });
      seenIds.add(id);
      return;
    }

    const name =
      typeof provider.name === "string"
        ? provider.name.trim().slice(0, 30)
        : "";
    const urlTemplate =
      typeof provider.urlTemplate === "string"
        ? provider.urlTemplate.trim()
        : "";
    if (!name || getSearchProviderTemplateError(urlTemplate)) return;

    merged.push({
      id,
      name,
      urlTemplate,
      isEnabled: Boolean(provider.isEnabled),
      isCustom: true,
    });
    seenIds.add(id);
  });

  const existingIds = new Set(merged.map((provider) => provider.id));
  DEFAULT_SEARCH_PROVIDERS.forEach((provider) => {
    if (!existingIds.has(provider.id)) {
      merged.push(provider);
    }
  });

  return merged;
}

export function getSearchProviderTemplateError(
  urlTemplate: string,
): string | null {
  const template = urlTemplate.trim();
  if (!template) return "请输入搜索网址";

  const placeholderCount = template.split("%s").length - 1;
  if (placeholderCount !== 1) return "搜索网址需要包含一个 %s";

  try {
    const url = new URL(template.replace("%s", "goose-note-search"));
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "搜索网址仅支持 http 或 https";
    }
  } catch {
    return "请输入有效的网址";
  }

  return null;
}
