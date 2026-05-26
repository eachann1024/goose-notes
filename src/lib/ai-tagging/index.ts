// AI 标签 / 起标题：轻量级独立工具，不走 capability/intent 框架。
// UI 直接调用，返回结果或空。失败时不抛错，返回空（保证不污染编辑器状态）。

import type { Page } from "@/types";
import { blocksToMarkdown } from "@/lib/export";
import { runAITextStream } from "@/lib/ai-provider";
import type { AISettingsLike } from "@/lib/ai-provider";

const TAGS_SYSTEM_PROMPT = `你是一个笔记标签助手。基于正文给出 3-6 个简洁标签：
- 优先复用已有标签风格（如果用户已有标签清单，新标签用同样命名习惯）
- 嵌套用斜杠（如 work/ai、学习/算法）
- 不要超过 4 个字（除非是固定术语）
- 中文笔记给中文标签，英文笔记给英文标签

仅输出 JSON：{ "tags": ["..."], "reason": "..." }。不要 markdown 代码围栏，不要解释。`;

const TITLE_SYSTEM_PROMPT = `你是一个笔记起标题助手。基于正文给一个简洁、信息量足够的标题：
- 10-20 字（中文）或 5-10 词（英文）
- 不要 emoji（除非用户已有 emoji 习惯）
- 不要标点结尾

仅输出 JSON：{ "title": "..." }。不要 markdown 代码围栏，不要解释。`;

function safeParseJson<T>(text: string): T | null {
  // 去掉常见的 markdown 代码围栏
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

async function buildPageMarkdown(page: Page): Promise<string> {
  try {
    const md = await blocksToMarkdown(page.content as any);
    // 截断过长正文，避免超 token（首 3000 字符足够建议标签/标题）
    return md.slice(0, 3000);
  } catch {
    return "";
  }
}

export interface SuggestTagsOptions {
  settings: AISettingsLike;
  page: Page;
  existingTags?: string[];
  abortSignal?: AbortSignal;
}

export async function suggestTags(opts: SuggestTagsOptions): Promise<string[]> {
  const md = await buildPageMarkdown(opts.page);
  if (!md.trim()) return [];

  const existing = (opts.existingTags ?? []).slice(0, 50).join(", ");
  const userPrompt = `当前笔记标题：${opts.page.id}\n\n当前已有标签清单（全局）：${existing || "（无）"}\n\n笔记正文：\n${md}`;

  try {
    const text = await new Promise<string>((resolve, reject) => {
      let final = "";
      runAITextStream(opts.settings, [
        { role: "system", content: TAGS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ], {
        abortSignal: opts.abortSignal,
        onUpdate: (u) => {
          if (u.phase === "generating" || u.phase === "finishing") {
            final = u.text;
          }
        },
      })
        .then(() => resolve(final))
        .catch(reject);
    });

    const parsed = safeParseJson<{ tags?: unknown }>(text);
    if (!parsed || !Array.isArray(parsed.tags)) return [];
    return parsed.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch (err) {
    console.warn("[ai-tagging] suggestTags failed:", err);
    return [];
  }
}

export interface SuggestTitleOptions {
  settings: AISettingsLike;
  page: Page;
  abortSignal?: AbortSignal;
}

export async function suggestTitle(opts: SuggestTitleOptions): Promise<string | null> {
  const md = await buildPageMarkdown(opts.page);
  if (!md.trim()) return null;

  try {
    const text = await new Promise<string>((resolve, reject) => {
      let final = "";
      runAITextStream(opts.settings, [
        { role: "system", content: TITLE_SYSTEM_PROMPT },
        { role: "user", content: md },
      ], {
        abortSignal: opts.abortSignal,
        onUpdate: (u) => {
          if (u.phase === "generating" || u.phase === "finishing") {
            final = u.text;
          }
        },
      })
        .then(() => resolve(final))
        .catch(reject);
    });

    const parsed = safeParseJson<{ title?: unknown }>(text);
    if (!parsed || typeof parsed.title !== "string") return null;
    return parsed.title.trim() || null;
  } catch (err) {
    console.warn("[ai-tagging] suggestTitle failed:", err);
    return null;
  }
}
