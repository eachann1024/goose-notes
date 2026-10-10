import type { JSONContent } from "@/types";
import type {
  AiComposerPayload,
  AiComposerToken,
  AiFileReferenceAttrs,
  AiImageAttachmentAttrs,
  AiSkillCommandAttrs,
  AiSelectionQuoteAttrs,
} from "./referenceTypes";
import {
  formatSelectionQuotePromptLabel,
  parseSelectionQuoteAttrs,
} from "./selectionQuote";

function normalizeImageAttachmentAttrs(
  attrs: unknown,
): AiImageAttachmentAttrs | null {
  if (!attrs || typeof attrs !== "object") return null;
  const source = attrs as Record<string, unknown>;
  const imageId = typeof source.imageId === "string" ? source.imageId : "";
  if (!imageId) return null;
  return {
    imageId,
    fileName: typeof source.fileName === "string" ? source.fileName : "图片",
    mediaType:
      typeof source.mediaType === "string" ? source.mediaType : "image/*",
    size: typeof source.size === "number" ? source.size : 0,
  };
}

function normalizeSkillCommandAttrs(
  attrs: unknown,
): AiSkillCommandAttrs | null {
  if (!attrs || typeof attrs !== "object") return null;
  const source = attrs as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  if (!name) return null;
  return {
    name,
    path: typeof source.path === "string" ? source.path : undefined,
    description:
      typeof source.description === "string" ? source.description : undefined,
  };
}

function collectInlineContent(
  content: JSONContent[] | undefined,
  references: AiFileReferenceAttrs[],
  images: AiImageAttachmentAttrs[],
  skills: AiSkillCommandAttrs[],
  skillNames: Set<string>,
  selectionQuotes: AiSelectionQuoteAttrs[],
  tokens: AiComposerToken[],
) {
  let promptText = "";
  let freeformText = "";

  content?.forEach((node) => {
    if (node.type === "text") {
      const text = node.text ?? "";
      promptText += text;
      freeformText += text;
      tokens.push({
        type: "text",
        text,
      });
      return;
    }

    if (node.type === "hardBreak") {
      promptText += "\n";
      freeformText += "\n";
      tokens.push({
        type: "text",
        text: "\n",
      });
      return;
    }

    if (node.type === "aiFileReference") {
      const attrs = {
        pageId: String(node.attrs?.pageId ?? ""),
        workspaceId: String(node.attrs?.workspaceId ?? ""),
        titleSnapshot: String(node.attrs?.titleSnapshot ?? "未命名文件"),
        sourceType:
          node.attrs?.sourceType === "local-file" ? "local-file" : "app-page",
        localFilePath:
          typeof node.attrs?.localFilePath === "string"
            ? node.attrs.localFilePath
            : undefined,
        notebookNameSnapshot:
          typeof node.attrs?.notebookNameSnapshot === "string"
            ? node.attrs.notebookNameSnapshot
            : undefined,
        locationSnapshot:
          typeof node.attrs?.locationSnapshot === "string"
            ? node.attrs.locationSnapshot
            : undefined,
        role:
          node.attrs?.role === "target" || node.attrs?.role === "context"
            ? node.attrs.role
            : undefined,
      } satisfies AiFileReferenceAttrs;

      references.push(attrs);
      promptText += `@${attrs.titleSnapshot}`;
      tokens.push({
        type: "reference",
        reference: attrs,
      });
      return;
    }

    if (node.type === "aiImageAttachment") {
      const attrs = normalizeImageAttachmentAttrs(node.attrs);
      if (!attrs) return;
      images.push(attrs);
      promptText += `[图片 ${attrs.fileName}]`;
      tokens.push({
        type: "image",
        image: attrs,
      });
      return;
    }

    if (node.type === "aiSkillCommand") {
      const attrs = normalizeSkillCommandAttrs(node.attrs);
      if (!attrs) return;
      // payload.skills：按 name 第一次出现顺序去重；tokens 仍保留每次出现。
      if (!skillNames.has(attrs.name)) {
        skillNames.add(attrs.name);
        skills.push(attrs);
      }
      // 与 @ 引用对称：chip 文本进 promptText，不进 freeformText
      promptText += `/${attrs.name}`;
      tokens.push({
        type: "skill",
        skill: attrs,
      });
      return;
    }

    if (node.type === "aiSelectionQuote") {
      const attrs = parseSelectionQuoteAttrs(node.attrs);
      if (!attrs) return;
      selectionQuotes.push(attrs);
      promptText += formatSelectionQuotePromptLabel(attrs);
      tokens.push({
        type: "selectionQuote",
        quote: attrs,
      });
    }
  });

  return { promptText, freeformText };
}

export function serializeAiComposerDoc(
  content: JSONContent | null | undefined,
): AiComposerPayload {
  if (!content?.content?.length) {
    return {
      promptText: "",
      freeformText: "",
      references: [],
      images: [],
      skills: [],
      selectionQuotes: [],
      tokens: [],
    };
  }

  const references: AiFileReferenceAttrs[] = [];
  const images: AiImageAttachmentAttrs[] = [];
  const skills: AiSkillCommandAttrs[] = [];
  const skillNames = new Set<string>();
  const selectionQuotes: AiSelectionQuoteAttrs[] = [];
  const promptBlocks: string[] = [];
  const freeformBlocks: string[] = [];
  const tokens: AiComposerToken[] = [];

  content.content.forEach((block: any) => {
    if (block.type !== "paragraph") {
      return;
    }

    const inline = collectInlineContent(
      block.content,
      references,
      images,
      skills,
      skillNames,
      selectionQuotes,
      tokens,
    );
    promptBlocks.push(inline.promptText);
    freeformBlocks.push(inline.freeformText);
    tokens.push({
      type: "text",
      text: "\n",
    });
  });

  return {
    promptText: promptBlocks.join("\n").trim(),
    freeformText: freeformBlocks.join("\n").trim(),
    references,
    images,
    skills,
    selectionQuotes,
    tokens,
  };
}
