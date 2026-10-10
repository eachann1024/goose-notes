import type { AiSelectionQuoteAttrs } from "./selectionQuote";

export type { AiSelectionQuoteAttrs };

export type AiFileReferenceSourceType = "app-page" | "local-file";
export type AiReferenceRole = "context" | "target";

export interface AiFileReferenceAttrs {
  pageId: string;
  workspaceId: string;
  titleSnapshot: string;
  sourceType: AiFileReferenceSourceType;
  localFilePath?: string;
  notebookNameSnapshot?: string;
  locationSnapshot?: string;
  /** 可选显式角色；未设置时由邻近文本推断。 */
  role?: AiReferenceRole;
}

export interface AiReferenceSuggestionItem extends AiFileReferenceAttrs {
  title: string;
  description: string;
  isFolder?: boolean;
}

/**
 * 内联图片附件的可序列化属性。
 * 真实 File / previewUrl 由 composer 注册表按 imageId 维护，不进 JSONContent。
 */
export interface AiImageAttachmentAttrs {
  imageId: string;
  fileName: string;
  mediaType: string;
  size: number;
}

/** Skill 命令 chip 的可序列化属性（JSON node type: aiSkillCommand） */
export interface AiSkillCommandAttrs {
  name: string;
  path?: string;
  description?: string;
}

export type AiComposerToken =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "reference";
      reference: AiFileReferenceAttrs;
      role?: AiReferenceRole;
    }
  | {
      type: "image";
      image: AiImageAttachmentAttrs;
    }
  | {
      type: "skill";
      skill: AiSkillCommandAttrs;
    }
  | {
      type: "selectionQuote";
      quote: AiSelectionQuoteAttrs;
    };

export interface AiComposerPayload {
  promptText: string;
  freeformText: string;
  /** 唯一资源列表，按第一次出现顺序排列。 */
  references: AiFileReferenceAttrs[];
  /** 内联图片 token，按在输入框中出现的顺序排列 */
  images: AiImageAttachmentAttrs[];
  /** 本地 Skill 调用，按 name 第一次出现顺序去重 */
  skills: AiSkillCommandAttrs[];
  /** 选区引用 chip，按出现顺序；含完整选区文本 */
  selectionQuotes?: AiSelectionQuoteAttrs[];
  /** 完整有序 token；同一资源可出现多次并保留每处角色。 */
  tokens: AiComposerToken[];
}

export interface AiReferenceOccurrence {
  occurrenceId: string;
  tokenIndex: number;
  pageId: string;
  role: AiReferenceRole;
  roleSource: "explicit" | "inferred" | "default";
}

export interface NormalizedAiComposerPayload {
  payload: AiComposerPayload;
  resources: AiFileReferenceAttrs[];
  occurrences: AiReferenceOccurrence[];
  contextReferences: AiFileReferenceAttrs[];
  targetReferences: AiFileReferenceAttrs[];
  hasRoleConflict: boolean;
}

export interface ResolvedAiReferenceContext {
  reference: AiFileReferenceAttrs;
  title: string;
  sourceType: AiFileReferenceSourceType;
  notebookName: string;
  location: string;
  contentText: string;
  structureSummary: string;
  readStatus: "ready" | "error";
  errorMessage?: string;
}
