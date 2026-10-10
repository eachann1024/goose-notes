import { isMap, parseDocument } from "yaml";
import { extractFrontmatter } from "../markdown-raw-guard";
import {
  DEFAULT_SETTINGS,
  settingsFromData,
  type LocalPageFrontmatterSettings,
} from "./settings";

function stripFrontmatterDelimiters(blob: string): string {
  const lines = blob.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length >= 2 && lines[0].trim() === "---") {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i;
        break;
      }
    }
    if (endIdx !== -1) {
      return lines.slice(1, endIdx).join("\n");
    }
  }
  return blob;
}

/**
 * 解析 frontmatter 原文 blob（可含 --- 定界符）。
 * 失败时 settings 回退默认，调用方应保留原 blob 不覆盖。
 */
export function parseLocalFrontmatterBlob(blob: string | null | undefined): {
  ok: boolean;
  data: Record<string, unknown>;
  settings: LocalPageFrontmatterSettings;
  error?: string;
} {
  if (!blob || !blob.trim()) {
    return { ok: true, data: {}, settings: { ...DEFAULT_SETTINGS } };
  }

  if (
    /^---\s*(?:\n|$)/.test(blob.replace(/\r\n?/g, "\n")) &&
    !extractFrontmatter(blob).frontmatter
  ) {
    return {
      ok: false,
      data: {},
      settings: { ...DEFAULT_SETTINGS },
      error: "YAML 前置区未闭合",
    };
  }
  const yamlText = stripFrontmatterDelimiters(blob);
  if (!yamlText.trim()) {
    return { ok: true, data: {}, settings: { ...DEFAULT_SETTINGS } };
  }

  try {
    const document = parseDocument(yamlText);
    if (document.errors.length) throw document.errors[0];
    if (!document.contents) {
      return { ok: true, data: {}, settings: { ...DEFAULT_SETTINGS } };
    }
    if (!isMap(document.contents)) {
      return {
        ok: false,
        data: {},
        settings: { ...DEFAULT_SETTINGS },
        error: "frontmatter 根节点必须是对象",
      };
    }
    const parsed = document.toJS() as Record<string, unknown>;
    return {
      ok: true,
      data: { ...parsed },
      settings: settingsFromData(parsed),
    };
  } catch {
    return {
      ok: false,
      data: {},
      settings: { ...DEFAULT_SETTINGS },
      error: "YAML 解析失败",
    };
  }
}

/**
 * 从完整 markdown 文本恢复页面设置（扫描/reload 用）。
 */
export function pageSettingsFromMarkdown(
  markdown: string | null | undefined,
): LocalPageFrontmatterSettings {
  if (markdown == null) return { ...DEFAULT_SETTINGS };
  const { frontmatter } = extractFrontmatter(markdown);
  return parseLocalFrontmatterBlob(frontmatter).settings;
}
