/**
 * contenteditable DOM ↔ token / payload / JSONContent 互转。
 * 被 AiComposerInput 读写草稿、水合初始内容时使用。
 * 依赖 mention/skill/图片 chip 工厂与 ZWSP 锚点。
 */
import type { JSONContent } from "@/types";
import type {
  AiComposerPayload,
  AiComposerToken,
  AiFileReferenceAttrs,
  AiImageAttachmentAttrs,
  AiSkillCommandAttrs,
  AiSelectionQuoteAttrs,
} from "./referenceLookup";
import { formatSelectionQuotePromptLabel, createSelectionQuoteChipElement } from "./selectionQuote";
import { createChipElement } from "./useReferenceMentions";
import {
  createSkillChipElement,
  ensureComposerCaretAnchors,
  stripComposerCaretZwsp,
} from "./useSkillCommands";
import {
  createImageChipElement,
  type ComposerImageRegistry,
} from "./composerImageChip";

export function readTokensFromDom(container: HTMLElement): AiComposerToken[] {
  const tokens: AiComposerToken[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // 剥掉光标锚点 ZWSP，避免进 prompt / 气泡
      const text = stripComposerCaretZwsp(node.textContent ?? "");
      if (text) tokens.push({ type: "text", text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") {
        tokens.push({ type: "text", text: "\n" });
      } else if (el.dataset.aiMentionAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiMentionAttrs,
          ) as AiFileReferenceAttrs;
          tokens.push({ type: "reference", reference: attrs });
        } catch {
          // ignore malformed chip
        }
      } else if (el.dataset.aiImageAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiImageAttrs,
          ) as AiImageAttachmentAttrs;
          tokens.push({ type: "image", image: attrs });
        } catch {
          // ignore malformed chip
        }
      } else if (el.dataset.aiSkillAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiSkillAttrs,
          ) as AiSkillCommandAttrs;
          tokens.push({ type: "skill", skill: attrs });
        } catch {
          // ignore malformed chip
        }
      } else if (el.dataset.aiSelectionQuoteAttrs) {
        try {
          const attrs = JSON.parse(
            el.dataset.aiSelectionQuoteAttrs,
          ) as AiSelectionQuoteAttrs;
          if (attrs.pageId && attrs.text) {
            tokens.push({ type: "selectionQuote", quote: attrs });
          }
        } catch {
          // ignore malformed chip
        }
      } else {
        el.childNodes.forEach(walk);
      }
    }
  }

  container.childNodes.forEach(walk);
  return tokens;
}

export function buildPayloadFromTokens(tokens: AiComposerToken[]): AiComposerPayload {
  const references: AiFileReferenceAttrs[] = [];
  const images: AiImageAttachmentAttrs[] = [];
  const skills: AiSkillCommandAttrs[] = [];
  const selectionQuotes: AiSelectionQuoteAttrs[] = [];
  let promptText = "";
  let freeformText = "";

  for (const token of tokens) {
    if (token.type === "text") {
      promptText += token.text;
      freeformText += token.text;
    } else if (token.type === "reference") {
      references.push(token.reference);
      promptText += `@${token.reference.titleSnapshot}`;
    } else if (token.type === "image") {
      images.push(token.image);
      promptText += `[图片 ${token.image.fileName}]`;
    } else if (token.type === "skill") {
      skills.push(token.skill);
      // 与 @ 对称：chip 标签进 promptText，不进 freeformText
      promptText += `/${token.skill.name}`;
    } else if (token.type === "selectionQuote") {
      selectionQuotes.push(token.quote);
      promptText += formatSelectionQuotePromptLabel(token.quote);
    }
  }

  return {
    promptText: promptText.trim(),
    freeformText: freeformText.trim(),
    references,
    images,
    skills,
    selectionQuotes,
    tokens,
  };
}

/** 发送按钮 / 占位符：无文本、引用、图片、Skill、选区引用才视为空 */
export function isComposerPayloadEmpty(
  payload: Pick<
    AiComposerPayload,
    "promptText" | "references" | "images" | "skills"
  > & { selectionQuotes?: AiSelectionQuoteAttrs[] },
): boolean {
  return (
    payload.promptText.length === 0 &&
    payload.references.length === 0 &&
    payload.images.length === 0 &&
    payload.skills.length === 0 &&
    (payload.selectionQuotes?.length ?? 0) === 0
  );
}

/** 空会话默认 @：无内容或只有一条文件引用（可带空白）才允许自动替换 */
export function inspectDefaultComposerTokens(tokens: AiComposerToken[]): {
  replaceable: boolean;
  solePageId: string | null;
} {
  let solePageId: string | null = null;
  for (const token of tokens) {
    if (token.type === "text") {
      if (token.text.trim()) return { replaceable: false, solePageId: null };
      continue;
    }
    if (token.type === "reference") {
      const nextPageId = token.reference.pageId;
      if (!nextPageId || (solePageId && solePageId !== nextPageId)) {
        return { replaceable: false, solePageId: null };
      }
      solePageId = nextPageId;
      continue;
    }
    return { replaceable: false, solePageId: null };
  }
  return { replaceable: true, solePageId };
}

export function buildComposerDraftFromReference(
  reference: AiFileReferenceAttrs,
): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "aiFileReference", attrs: reference }],
      },
    ],
  };
}

export function buildJsonContentFromTokens(
  tokens: AiComposerToken[],
): JSONContent | null {
  if (!tokens.length) return null;

  const paragraphs: AiComposerToken[][] = [[]];

  for (const token of tokens) {
    if (token.type === "text") {
      const parts = token.text.split("\n");
      if (parts[0])
        paragraphs[paragraphs.length - 1].push({
          type: "text",
          text: parts[0],
        });
      for (let i = 1; i < parts.length; i++) {
        paragraphs.push([]);
        if (parts[i])
          paragraphs[paragraphs.length - 1].push({
            type: "text",
            text: parts[i],
          });
      }
    } else {
      paragraphs[paragraphs.length - 1].push(token);
    }
  }

  if (!paragraphs.some((p) => p.length > 0)) return null;

  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: line.map((token) => {
        if (token.type === "text") return { type: "text", text: token.text };
        if (token.type === "reference")
          return { type: "aiFileReference", attrs: token.reference };
        if (token.type === "skill")
          return { type: "aiSkillCommand", attrs: token.skill };
        if (token.type === "selectionQuote")
          return { type: "aiSelectionQuote", attrs: token.quote };
        return { type: "aiImageAttachment", attrs: token.image };
      }),
    })),
  };
}

export function setDomFromJsonContent(
  container: HTMLElement,
  content: JSONContent | null | undefined,
  registry: ComposerImageRegistry,
) {
  container.innerHTML = "";
  if (!content?.content?.length) return;

  content.content.forEach((block: any, blockIdx: number) => {
    if (blockIdx > 0) container.appendChild(document.createElement("br"));
    (block.content ?? []).forEach((node: any) => {
      if (node.type === "text") {
        container.appendChild(document.createTextNode(node.text ?? ""));
      } else if (node.type === "aiFileReference" && node.attrs) {
        container.appendChild(
          createChipElement(node.attrs as AiFileReferenceAttrs),
        );
      } else if (node.type === "aiImageAttachment" && node.attrs) {
        container.appendChild(
          createImageChipElement(
            node.attrs as AiImageAttachmentAttrs,
            registry,
          ),
        );
      } else if (node.type === "aiSkillCommand" && node.attrs) {
        container.appendChild(
          createSkillChipElement(node.attrs as AiSkillCommandAttrs),
        );
      } else if (node.type === "aiSelectionQuote" && node.attrs) {
        container.appendChild(
          createSelectionQuoteChipElement(
            node.attrs as AiSelectionQuoteAttrs,
          ),
        );
      }
    });
  });
  // 水合后补 ZWSP 锚点，避免只有 chip 时光标不可见
  ensureComposerCaretAnchors(container);
}
