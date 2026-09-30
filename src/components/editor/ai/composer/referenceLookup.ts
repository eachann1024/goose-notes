import type { JSONContent, Page } from "@/types";
import type { Notebook } from "@/stores/useNotebooks";
import {
  extractStructureSummary,
  extractTextFromContent,
} from "@/components/editor/utils/content-text-extractor";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { isPinyinQuery, pinyinMatchIndices } from "@/lib/pinyin-search";
import {
  formatSelectionQuotePromptLabel,
  parseSelectionQuoteAttrs,
  type AiSelectionQuoteAttrs,
} from "./selectionQuote";

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

const TARGET_CUE_PATTERN =
  /(生成到|写到|写入到|写进|放到|放进|保存到|同步到|输出到|替换到|覆盖到|改写到|更新到|汇总到|合并到|追加到|删除|移除|重命名|改名)/i;
const TARGET_PREFIX_PATTERN = /(删除|移除|重命名|改名)$/i;
const CONTEXT_CUE_PATTERN =
  /(参考|参照|结合|基于|根据|对照|引用|读取|查看|分析|汇总)/i;

function collectReferenceNeighborText(
  tokens: AiComposerToken[],
  index: number,
  direction: "before" | "after",
  maxLength = 24,
) {
  let remaining = maxLength;
  let cursor = direction === "before" ? index - 1 : index + 1;
  const parts: string[] = [];
  while (cursor >= 0 && cursor < tokens.length && remaining > 0) {
    const token = tokens[cursor];
    // 只看与当前引用直接相邻的文本，不能越过另一个引用或图片，
    // 否则“@A @B 汇总到 @C”会把 A/B 误判成目标。
    if (token.type !== "text") break;
    const text = token.text;
    const slice =
      direction === "before"
        ? text.slice(Math.max(0, text.length - remaining))
        : text.slice(0, remaining);
    if (direction === "before") parts.unshift(slice);
    else parts.push(slice);
    remaining -= slice.length;
    cursor += direction === "before" ? -1 : 1;
  }
  return parts.join("").replace(/\s+/g, "");
}

export function inferAiReferenceRole(
  tokens: AiComposerToken[],
  tokenIndex: number,
): Pick<AiReferenceOccurrence, "role" | "roleSource"> {
  const token = tokens[tokenIndex];
  if (token?.type !== "reference") {
    return { role: "context", roleSource: "default" };
  }
  const explicitRole = token.role ?? token.reference.role;
  if (explicitRole) return { role: explicitRole, roleSource: "explicit" };
  const before = collectReferenceNeighborText(tokens, tokenIndex, "before");
  const after = collectReferenceNeighborText(tokens, tokenIndex, "after");
  if (TARGET_CUE_PATTERN.test(before) || TARGET_PREFIX_PATTERN.test(after)) {
    return { role: "target", roleSource: "inferred" };
  }
  if (CONTEXT_CUE_PATTERN.test(before) || CONTEXT_CUE_PATTERN.test(after)) {
    return { role: "context", roleSource: "inferred" };
  }
  return { role: "context", roleSource: "default" };
}

/**
 * 规范化 composer payload：资源按 pageId 唯一，出现记录仍完整保序。
 * 不修改传入对象，避免调用方之间共享可变 references 数组。
 */
export function normalizeAiComposerPayload(
  input: AiComposerPayload,
): NormalizedAiComposerPayload {
  const resources: AiFileReferenceAttrs[] = [];
  const resourceMap = new Map<string, AiFileReferenceAttrs>();
  const occurrences: AiReferenceOccurrence[] = [];

  input.tokens.forEach((token, tokenIndex) => {
    if (token.type !== "reference" || !token.reference.pageId) return;
    const { role, roleSource } = inferAiReferenceRole(input.tokens, tokenIndex);
    if (!resourceMap.has(token.reference.pageId)) {
      const resource = { ...token.reference };
      delete resource.role;
      resourceMap.set(token.reference.pageId, resource);
      resources.push(resource);
    }
    occurrences.push({
      occurrenceId: `${token.reference.pageId}:${tokenIndex}`,
      tokenIndex,
      pageId: token.reference.pageId,
      role,
      roleSource,
    });
  });

  // 兼容旧 payload：tokens 为空或缺失引用 token 时仍消费 references。
  input.references.forEach((reference) => {
    if (!reference.pageId || resourceMap.has(reference.pageId)) return;
    const resource = { ...reference };
    delete resource.role;
    resourceMap.set(reference.pageId, resource);
    resources.push(resource);
    occurrences.push({
      occurrenceId: `${reference.pageId}:legacy-${occurrences.length}`,
      tokenIndex: -1,
      pageId: reference.pageId,
      role: reference.role ?? "context",
      roleSource: reference.role ? "explicit" : "default",
    });
  });

  const rolesByPage = new Map<string, Set<AiReferenceRole>>();
  occurrences.forEach((occurrence) => {
    const roles =
      rolesByPage.get(occurrence.pageId) ?? new Set<AiReferenceRole>();
    roles.add(occurrence.role);
    rolesByPage.set(occurrence.pageId, roles);
  });
  const contextReferences = resources.filter((reference) => {
    const pageOccurrences = occurrences.filter(
      (occurrence) => occurrence.pageId === reference.pageId,
    );
    // 同一资源同时作为参考和目标时只解析一次，但仍作为读取上下文。
    // 纯目标资源不读取正文，避免无意义的 token 消耗。
    return pageOccurrences.some((occurrence) => occurrence.role === "context");
  });
  const targetReferences = resources.filter((reference) =>
    occurrences.some(
      (occurrence) =>
        occurrence.pageId === reference.pageId && occurrence.role === "target",
    ),
  );

  return {
    payload: { ...input, references: resources },
    resources,
    occurrences,
    contextReferences,
    targetReferences,
    hasRoleConflict: [...rolesByPage.values()].some((roles) => roles.size > 1),
  };
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

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getSourceType(page: Page): AiFileReferenceSourceType {
  return page.localFilePath ? "local-file" : "app-page";
}

function getNotebookSnapshot(
  workspaceId: string,
  notebooks: Record<string, Notebook>,
) {
  return notebooks[workspaceId];
}

function getLocationSnapshot(page: Page, notebooks: Record<string, Notebook>) {
  const notebook = getNotebookSnapshot(page.workspaceId, notebooks);
  if (!page.localFilePath) return notebook?.name ?? "未知笔记本";

  const basePath = notebook?.localPath?.replace(/[\\/]+$/, "") ?? "";
  const normalizedPath = page.localFilePath.replace(/[\\/]+/g, "/");
  const normalizedBase = basePath.replace(/[\\/]+/g, "/");

  if (normalizedBase && normalizedPath.startsWith(normalizedBase)) {
    const relativePath = normalizedPath
      .slice(normalizedBase.length)
      .replace(/^\/+/, "");
    return relativePath || normalizedPath;
  }

  return normalizedPath;
}

/**
 * 建议列表副标题：本地文件只展示相对路径（如 Dev/New Project/Codex.md），
 * 避免「本地文件 · 0Markdown · …」重复上级信息；跨笔记本时才补笔记本名。
 */
function buildDescription(
  page: Page,
  notebooks: Record<string, Notebook>,
  activeNotebookId: string | null,
) {
  const wsId = page.workspaceId ?? (page as { notebookId?: string }).notebookId;
  const notebook = getNotebookSnapshot(wsId, notebooks);
  const notebookName = notebook?.name ?? "未知笔记本";
  const isActiveNotebook =
    activeNotebookId != null && wsId === activeNotebookId;

  if (page.isFolder || page.localFilePath) {
    const location = getLocationSnapshot(page, notebooks);
    if (isActiveNotebook) return location;
    return `${notebookName} · ${location}`;
  }

  return isActiveNotebook ? "应用页面" : `应用页面 · ${notebookName}`;
}

function pageFilenameStem(page: Page): string {
  if (!page.localFilePath) return getPageTitle(page);
  const name = page.localFilePath.split(/[\\/]/).pop() || "";
  return name.replace(/\.(md|markdown)$/i, "").trim() || getPageTitle(page);
}

function splitSearchTokens(value: string): string[] {
  return value.split(/[\s/_.:-]+/).filter(Boolean);
}

/**
 * 只搜标题、文件名、相对路径，不搜笔记正文。
 * 分数越小越靠前：精确标题 > 前缀 > 分段 > 子串 > 路径 > 拼音。
 */
function scoreFieldMatch(field: string, query: string, base: number): number | null {
  if (!field) return null;
  if (field === query) return base;
  if (field.startsWith(query)) return base + 10;
  if (splitSearchTokens(field).includes(query)) return base + 20;
  if (field.includes(query)) return base + 30;
  return null;
}

function scoreAiReferenceQuery(
  page: Page,
  notebooks: Record<string, Notebook>,
  normalizedQuery: string,
  rawQuery: string,
): number | null {
  if (!normalizedQuery) return 0;

  const title = normalizeSearchValue(getPageTitle(page));
  const filename = normalizeSearchValue(pageFilenameStem(page));
  const location = normalizeSearchValue(
    getLocationSnapshot(page, notebooks).replace(/\.(md|markdown)$/i, ""),
  );

  let best = Number.POSITIVE_INFINITY;
  const consider = (score: number | null) => {
    if (score != null && score < best) best = score;
  };

  consider(scoreFieldMatch(title, normalizedQuery, 0));
  consider(scoreFieldMatch(filename, normalizedQuery, 1));

  if (
    page.localFilePath &&
    location &&
    location !== title &&
    location !== filename
  ) {
    const segments = location.split("/").filter(Boolean);
    if (segments.some((part) => part === normalizedQuery)) consider(40);
    else if (segments.some((part) => part.startsWith(normalizedQuery))) {
      consider(45);
    } else if (location.includes(normalizedQuery)) consider(50);
  }

  if (
    best === Number.POSITIVE_INFINITY &&
    isPinyinQuery(rawQuery.trim()) &&
    pinyinMatchIndices(getPageTitle(page), rawQuery.trim()) !== null
  ) {
    consider(60);
  }

  return best === Number.POSITIVE_INFINITY ? null : best;
}

function matchesAiReferenceQuery(
  page: Page,
  notebooks: Record<string, Notebook>,
  normalizedQuery: string,
  rawQuery: string,
) {
  return scoreAiReferenceQuery(page, notebooks, normalizedQuery, rawQuery) != null;
}

function compareSuggestionItems(
  a: Page,
  b: Page,
  activeNotebookId: string | null,
  notebooks: Record<string, Notebook>,
  queryScore?: (page: Page) => number,
) {
  if (queryScore) {
    const scoreDelta = queryScore(a) - queryScore(b);
    if (scoreDelta !== 0) return scoreDelta;
    const titleLenDelta = getPageTitle(a).length - getPageTitle(b).length;
    if (titleLenDelta !== 0) return titleLenDelta;
  }

  const aWsId = a.workspaceId ?? (a as { notebookId?: string }).notebookId;
  const bWsId = b.workspaceId ?? (b as { notebookId?: string }).notebookId;
  const aIsActiveNotebook = aWsId === activeNotebookId;
  const bIsActiveNotebook = bWsId === activeNotebookId;
  if (aIsActiveNotebook !== bIsActiveNotebook) {
    return aIsActiveNotebook ? -1 : 1;
  }

  const aNotebook = getNotebookSnapshot(aWsId, notebooks);
  const bNotebook = getNotebookSnapshot(bWsId, notebooks);
  const notebookCompare = (aNotebook?.name ?? "").localeCompare(
    bNotebook?.name ?? "",
    "zh-CN",
    { numeric: true },
  );
  if (notebookCompare !== 0) return notebookCompare;

  const titleCompare = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
    numeric: true,
  });
  if (titleCompare !== 0) return titleCompare;

  return a.id.localeCompare(b.id);
}

export function buildAiFileReferenceAttrs(
  page: Page,
  notebooks: Record<string, Notebook>,
): AiFileReferenceAttrs {
  const wsId = page.workspaceId ?? (page as { notebookId?: string }).notebookId;
  const notebook = getNotebookSnapshot(wsId, notebooks);
  return {
    pageId: page.id,
    workspaceId: wsId ?? "",
    titleSnapshot: getPageTitle(page),
    sourceType: getSourceType(page),
    localFilePath: page.localFilePath,
    notebookNameSnapshot: notebook?.name ?? "未知笔记本",
    locationSnapshot: getLocationSnapshot(page, notebooks),
  };
}

export function getAiReferenceSuggestionItems(
  query: string,
  pages: Record<string, Page>,
  notebooks: Record<string, Notebook>,
  activeNotebookId: string | null,
  options?: {
    includeFolders?: boolean;
    notebookId?: string | null;
    priorityPageId?: string | null;
  },
) {
  const normalizedQuery = normalizeSearchValue(query);

  return Object.values(pages)
    .filter((page) => !page.trashedAt)
    .filter((page) => {
      if (!options?.notebookId) return true;
      const wsId =
        page.workspaceId ?? (page as { notebookId?: string }).notebookId;
      return wsId === options.notebookId;
    })
    .filter((page) => options?.includeFolders || !page.isFolder)
    .filter((page) =>
      matchesAiReferenceQuery(page, notebooks, normalizedQuery, query),
    )
    .sort((a, b) => {
      if (!normalizedQuery && options?.priorityPageId) {
        if (a.id === options.priorityPageId) return -1;
        if (b.id === options.priorityPageId) return 1;
      }
      return compareSuggestionItems(
        a,
        b,
        activeNotebookId,
        notebooks,
        normalizedQuery
          ? (page) =>
              scoreAiReferenceQuery(page, notebooks, normalizedQuery, query) ??
              Number.POSITIVE_INFINITY
          : undefined,
      );
    })
    .slice(0, 30)
    .map((page) => {
      const attrs = buildAiFileReferenceAttrs(page, notebooks);
      return {
        ...attrs,
        title: attrs.titleSnapshot,
        description: buildDescription(page, notebooks, activeNotebookId),
        isFolder: page.isFolder,
      } satisfies AiReferenceSuggestionItem;
    });
}

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

function resolveReferenceLocation(
  page: Page,
  notebooks: Record<string, Notebook>,
) {
  const notebook = getNotebookSnapshot(page.workspaceId, notebooks);
  if (!page.localFilePath) {
    return notebook?.name ?? "未知笔记本";
  }

  return getLocationSnapshot(page, notebooks);
}

function listFolderChildLines(
  page: Page,
  pages: Record<string, Page>,
): string[] {
  return Object.values(pages)
    .filter((child) => child.parentId === page.id && !child.trashedAt)
    .sort((a, b) => {
      if (Boolean(a.isFolder) !== Boolean(b.isFolder))
        return a.isFolder ? -1 : 1;
      return getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
        numeric: true,
      });
    })
    .map((child) => {
      const title = getPageTitle(child);
      return child.isFolder ? `${title}/` : title;
    });
}

export function buildFolderReferenceContext(
  page: Page,
  pages: Record<string, Page>,
  notebooks: Record<string, Notebook>,
  reference: AiFileReferenceAttrs,
): ResolvedAiReferenceContext {
  const notebookName =
    notebooks[page.workspaceId]?.name ??
    reference.notebookNameSnapshot ??
    "未知笔记本";
  const childLines = listFolderChildLines(page, pages);
  const listing = childLines.length
    ? `目录子项：\n${childLines.map((line) => `- ${line}`).join("\n")}`
    : "（空目录）";
  return {
    reference,
    title: getPageTitle(page),
    sourceType: getSourceType(page),
    notebookName,
    location: resolveReferenceLocation(page, notebooks),
    contentText: listing,
    structureSummary: childLines.length
      ? `目录，${childLines.length} 个子项：\n${childLines.map((line) => `- ${line}`).join("\n")}`
      : "空目录",
    readStatus: "ready",
  };
}

function buildFallbackReferenceContext(
  reference: AiFileReferenceAttrs,
  errorMessage: string,
): ResolvedAiReferenceContext {
  return {
    reference,
    title: reference.titleSnapshot,
    sourceType: reference.sourceType,
    notebookName: reference.notebookNameSnapshot ?? "未知笔记本",
    location: reference.locationSnapshot ?? "未知位置",
    contentText: "",
    structureSummary: "",
    readStatus: "error",
    errorMessage,
  };
}

export function resolveAiReferenceContexts(
  references: AiFileReferenceAttrs[],
  pages: Record<string, Page>,
  notebooks: Record<string, Notebook>,
) {
  return references.map((reference) => {
    const page = pages[reference.pageId];
    if (!page) {
      return buildFallbackReferenceContext(
        reference,
        "引用目标不存在或尚未加载",
      );
    }

    const notebookName =
      notebooks[page.workspaceId]?.name ??
      reference.notebookNameSnapshot ??
      "未知笔记本";

    if (page.localFilePath && page.localReadState === "error") {
      return buildFallbackReferenceContext(
        reference,
        page.localReadError || "本地文件当前不可读取",
      );
    }

    if (page.isFolder) {
      return buildFolderReferenceContext(page, pages, notebooks, reference);
    }

    return {
      reference,
      title: getPageTitle(page),
      sourceType: getSourceType(page),
      notebookName,
      location: resolveReferenceLocation(page, notebooks),
      contentText: extractTextFromContent(page.content).trim(),
      structureSummary: extractStructureSummary(page.content),
      readStatus: "ready",
    } satisfies ResolvedAiReferenceContext;
  });
}

export function formatAiReferenceContextBlock(
  contexts: ResolvedAiReferenceContext[],
) {
  if (!contexts.length) return "";

  return contexts
    .map((context, index) => {
      const sourceLabel =
        context.sourceType === "local-file" ? "本地文件" : "应用页面";

      if (context.readStatus === "error") {
        return [
          `[引用 ${index + 1}]`,
          `标题：${context.title}`,
          `来源：${sourceLabel} · ${context.notebookName}`,
          `位置：${context.location}`,
          `状态：读取失败`,
          `错误：${context.errorMessage || "未知错误"}`,
        ].join("\n");
      }

      return [
        `[引用 ${index + 1}]`,
        `标题：${context.title}`,
        `来源：${sourceLabel} · ${context.notebookName}`,
        `位置：${context.location}`,
        context.structureSummary || context.contentText || "（空白内容）",
      ].join("\n");
    })
    .join("\n\n");
}

export function getAiReferenceStats(references: AiFileReferenceAttrs[]) {
  return references.reduce(
    (stats, reference) => {
      stats.referenceCount += 1;
      if (reference.sourceType === "local-file") {
        stats.localReferenceCount += 1;
      } else {
        stats.appReferenceCount += 1;
      }
      return stats;
    },
    {
      referenceCount: 0,
      appReferenceCount: 0,
      localReferenceCount: 0,
    },
  );
}
