import { parseLocalFrontmatterBlob } from "./local-frontmatter/parser";
export {
  parseLocalFrontmatterBlob,
  pageSettingsFromMarkdown,
} from "./local-frontmatter/parser";
/**
 * 本地文件夹页面设置 ↔ YAML frontmatter（方案 A）
 *
 * 白名单键（命名空间 goose-*，默认值省略写盘）：
 * - goose-layout: full | standard（旧 compact 按 standard 读取，未设置时跟随全局）
 * - goose-font: serif | mono（default 不写）
 * - goose-locked: true（false 不写）
 *
 * 未知键原样保留；解析失败时不改写原文 blob。
 */
import { stringify as stringifyYaml } from "yaml";
import type { PageContent } from "@/components/editor/utils/blocknote-content";
import { extractFrontmatter } from "./markdown-raw-guard";
import {
  GOOSE_LAYOUT_KEY,
  GOOSE_FONT_KEY,
  GOOSE_LOCKED_KEY,
  GOOSE_PINNED_KEY,
  GOOSE_FAVORITE_KEY,
  VALID_FONTS,
  normalizePageLayout,
  type LocalPageFrontmatterSettings,
} from "./local-frontmatter/settings";
export {
  GOOSE_LAYOUT_KEY,
  GOOSE_FONT_KEY,
  GOOSE_LOCKED_KEY,
  GOOSE_PINNED_KEY,
  GOOSE_FAVORITE_KEY,
  LOCAL_PAGE_FRONTMATTER_SETTINGS_KEYS,
  isLocalPageFrontmatterSettingsUpdate,
  normalizePageLayout,
  type LocalPageFrontmatterSettingsKey,
  type LocalPageFrontmatterSettings,
} from "./local-frontmatter/settings";

function wrapFrontmatter(yamlBody: string): string {
  const body = yamlBody.replace(/\s+$/, "");
  return body ? `---\n${body}\n---` : "---\n---";
}

export type MergeFrontmatterResult = {
  /** undefined = 文件无需 frontmatter 块 */
  blob: string | undefined;
  /** true 时 blob 为原样（或 undefined），未安全 merge */
  parseFailed: boolean;
  error?: string;
  settings: LocalPageFrontmatterSettings;
};

/** goose 命名空间键：只服务应用设置，单独存在时不在编辑器展示 YAML 块。 */
export function isGooseFrontmatterKey(key: string): boolean {
  return key.startsWith("goose-");
}

/**
 * YAML 里是否有用户可见属性（非 goose-*）。
 * 解析失败时视为可见，避免把坏 YAML 从编辑器藏起来。
 */
export function frontmatterBodyHasUserVisibleKeys(
  yamlBody: string | null | undefined,
): boolean {
  const parsed = parseLocalFrontmatterBlob(yamlBody);
  if (!parsed.ok) return Boolean((yamlBody ?? "").trim());
  return Object.keys(parsed.data).some((key) => !isGooseFrontmatterKey(key));
}

/** 取内容首块 yaml-frontmatter 的 YAML 正文（不含 --- 定界符），无则 null。 */
export function getContentFrontmatterBody(
  content: PageContent | null | undefined,
): string | null {
  if (!content || typeof content !== "object") return null;
  const blocks = Array.isArray(content) ? content : content?.content;
  if (!Array.isArray(blocks)) return null;
  const first = blocks[0] as
    | { type?: string; props?: Record<string, unknown>; content?: unknown }
    | undefined;
  if (first?.type !== "codeBlock") return null;
  if (first?.props?.language !== "yaml-frontmatter") return null;
  const c = first.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((n: any) => n?.text ?? "").join("");
  return null;
}

/**
 * 用某一段 YAML 正文替换内容首块 yaml-frontmatter。
 * 仅 goose 设置（收藏/置顶/字体/锁定）或空 YAML 时不插入、并去掉已有首块。
 */
export function applyFrontmatterBodyToContent(
  content: PageContent | null | undefined,
  yamlBody: string | null | undefined,
): PageContent {
  const blocks = Array.isArray(content)
    ? content
    : ((content?.content as any[] | undefined) ?? []);
  const trimmed = (yamlBody ?? "").replace(/\s+$/, "");
  const shouldShow =
    Boolean(trimmed) && frontmatterBodyHasUserVisibleKeys(trimmed);
  const fmBlock = shouldShow
    ? {
        type: "codeBlock",
        props: { language: "yaml-frontmatter" },
        content: trimmed,
      }
    : null;

  if (
    blocks[0]?.type === "codeBlock" &&
    blocks[0]?.props?.language === "yaml-frontmatter"
  ) {
    if (!fmBlock) {
      return blocks.slice(1) as PageContent;
    }
    return [
      { ...blocks[0], content: trimmed },
      ...blocks.slice(1),
    ] as PageContent;
  }

  return fmBlock
    ? ([fmBlock, ...blocks] as PageContent)
    : (blocks as PageContent);
}

/**
 * 把 goose 设置 merge 进「已以 --- 开头的 markdown」的头部 YAML 块。
 * 编辑器首块已是 yaml-frontmatter 时走这里：合并结果写回首块并返回，
 * 调用方不要再 prepend 一段独立 frontmatter，否则同文件会写出两个 --- 头。
 * markdown 不以 --- 开头时返回 null（调用方回退旧 prepend 路径）。
 */
export function mergeSettingsIntoFrontmatterHeader(
  markdown: string,
  settings: LocalPageFrontmatterSettings,
): { markdown: string; frontmatter: string | undefined } | null {
  if (!/^---\s*\n/.test(markdown)) return null;
  const { frontmatter, body } = extractFrontmatter(markdown);
  if (!frontmatter) throw new Error("YAML 前置区未闭合，已阻止保存");
  const merged = mergeLocalPageSettingsIntoFrontmatter(frontmatter, settings);
  if (merged.parseFailed) throw new Error("YAML 前置区格式异常，已阻止保存");
  const mergedBlob = merged.blob;
  return {
    markdown: mergedBlob ? `${mergedBlob}\n\n${body}` : body,
    frontmatter: mergedBlob,
  };
}

/**
 * 把白名单设置 merge 进 frontmatter。
 * - 默认值省略 goose 键
 * - 其它键保留
 * - 解析失败：不改写原文
 */
export function mergeLocalPageSettingsIntoFrontmatter(
  existingBlob: string | null | undefined,
  settings: LocalPageFrontmatterSettings,
): MergeFrontmatterResult {
  const fontFamily = VALID_FONTS.has(settings.fontFamily)
    ? settings.fontFamily
    : "default";
  const pageLayout =
    settings.pageLayout === undefined
      ? undefined
      : normalizePageLayout(settings.pageLayout);
  const isLocked = Boolean(settings.isLocked);
  const isPinned = Boolean(settings.isPinned);
  const isFavorite = Boolean(settings.isFavorite);
  const normalized: LocalPageFrontmatterSettings = {
    fontFamily,
    pageLayout,
    isLocked,
    isPinned,
    isFavorite,
  };

  const parsed = parseLocalFrontmatterBlob(existingBlob);
  if (!parsed.ok) {
    return {
      blob: existingBlob?.trim() ? existingBlob : undefined,
      parseFailed: true,
      error: parsed.error,
      settings: normalized,
    };
  }

  const data: Record<string, unknown> = { ...parsed.data };

  if (pageLayout === undefined) {
    delete data[GOOSE_LAYOUT_KEY];
  } else {
    data[GOOSE_LAYOUT_KEY] = pageLayout;
  }

  if (fontFamily === "default") {
    delete data[GOOSE_FONT_KEY];
  } else {
    data[GOOSE_FONT_KEY] = fontFamily;
  }

  if (!isLocked) {
    delete data[GOOSE_LOCKED_KEY];
  } else {
    data[GOOSE_LOCKED_KEY] = true;
  }

  if (!isPinned) {
    delete data[GOOSE_PINNED_KEY];
  } else {
    data[GOOSE_PINNED_KEY] = true;
  }

  if (!isFavorite) {
    delete data[GOOSE_FAVORITE_KEY];
  } else {
    data[GOOSE_FAVORITE_KEY] = true;
  }

  if (Object.keys(data).length === 0) {
    return {
      blob: undefined,
      parseFailed: false,
      settings: normalized,
    };
  }

  try {
    const yamlBody = stringifyYaml(data, {
      lineWidth: 0,
    }).replace(/\s+$/, "");
    return {
      blob: wrapFrontmatter(yamlBody),
      parseFailed: false,
      settings: normalized,
    };
  } catch (error) {
    return {
      blob: existingBlob?.trim() ? existingBlob : undefined,
      parseFailed: true,
      error: error instanceof Error ? error.message : "YAML 序列化失败",
      settings: normalized,
    };
  }
}
