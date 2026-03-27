import type { JSONContent, Page } from "@/types";
import { extractTextFromContent } from "@/lib/content-text-extractor";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

export type AiFileReferenceSourceType = "app-page" | "local-file";

export interface AiFileReferenceAttrs {
  pageId: string;
  workspaceId: string;
  titleSnapshot: string;
  sourceType: AiFileReferenceSourceType;
  localFilePath?: string;
  notebookNameSnapshot?: string;
  locationSnapshot?: string;
}

export interface AiReferenceSuggestionItem extends AiFileReferenceAttrs {
  title: string;
  description: string;
}

export interface AiComposerPayload {
  promptText: string;
  freeformText: string;
  references: AiFileReferenceAttrs[];
}

export interface ResolvedAiReferenceContext {
  reference: AiFileReferenceAttrs;
  title: string;
  sourceType: AiFileReferenceSourceType;
  notebookName: string;
  location: string;
  contentText: string;
  readStatus: "ready" | "error";
  errorMessage?: string;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getSourceType(page: Page): AiFileReferenceSourceType {
  return page.localFilePath ? "local-file" : "app-page";
}

function getNotebookSnapshot(workspaceId: string) {
  return useNotebooks.getState().notebooks[workspaceId];
}

function getLocationSnapshot(page: Page) {
  const notebook = getNotebookSnapshot(page.workspaceId);
  if (!page.localFilePath) return notebook?.name ?? "未知笔记本";

  const basePath = notebook?.localPath?.replace(/[\\/]+$/, "") ?? "";
  const normalizedPath = page.localFilePath.replace(/[\\/]+/g, "/");
  const normalizedBase = basePath.replace(/[\\/]+/g, "/");

  if (normalizedBase && normalizedPath.startsWith(normalizedBase)) {
    const relativePath = normalizedPath.slice(normalizedBase.length).replace(/^\/+/, "");
    return relativePath || normalizedPath;
  }

  return normalizedPath;
}

function buildDescription(page: Page) {
  const notebook = getNotebookSnapshot(page.workspaceId);
  const notebookName = notebook?.name ?? "未知笔记本";

  if (!page.localFilePath) {
    return `应用页面 · ${notebookName}`;
  }

  return `本地文件 · ${notebookName} · ${getLocationSnapshot(page)}`;
}

function getSearchHaystack(page: Page) {
  const notebook = getNotebookSnapshot(page.workspaceId);
  return [
    getPageTitle(page),
    notebook?.name ?? "",
    page.localFilePath ?? "",
    getLocationSnapshot(page),
  ]
    .join(" ")
    .toLowerCase();
}

function compareSuggestionItems(a: Page, b: Page, activeNotebookId: string | null) {
  const aIsActiveNotebook = a.workspaceId === activeNotebookId;
  const bIsActiveNotebook = b.workspaceId === activeNotebookId;
  if (aIsActiveNotebook !== bIsActiveNotebook) {
    return aIsActiveNotebook ? -1 : 1;
  }

  const aNotebook = getNotebookSnapshot(a.workspaceId);
  const bNotebook = getNotebookSnapshot(b.workspaceId);
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

export function buildAiFileReferenceAttrs(page: Page): AiFileReferenceAttrs {
  const notebook = getNotebookSnapshot(page.workspaceId);
  return {
    pageId: page.id,
    workspaceId: page.workspaceId,
    titleSnapshot: getPageTitle(page),
    sourceType: getSourceType(page),
    localFilePath: page.localFilePath,
    notebookNameSnapshot: notebook?.name ?? "未知笔记本",
    locationSnapshot: getLocationSnapshot(page),
  };
}

export function getAiReferenceSuggestionItems(query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  const { pages } = usePages.getState();
  const { activeNotebookId } = useNotebooks.getState();

  return Object.values(pages)
    .filter((page) => !page.trashedAt && !page.isFolder)
    .filter((page) => {
      if (!normalizedQuery) return true;
      return getSearchHaystack(page).includes(normalizedQuery);
    })
    .sort((a, b) => compareSuggestionItems(a, b, activeNotebookId))
    .slice(0, 30)
    .map((page) => {
      const attrs = buildAiFileReferenceAttrs(page);
      return {
        ...attrs,
        title: attrs.titleSnapshot,
        description: buildDescription(page),
      } satisfies AiReferenceSuggestionItem;
    });
}

function collectInlineContent(
  content: JSONContent[] | undefined,
  references: AiFileReferenceAttrs[],
) {
  let promptText = "";
  let freeformText = "";

  content?.forEach((node) => {
    if (node.type === "text") {
      const text = node.text ?? "";
      promptText += text;
      freeformText += text;
      return;
    }

    if (node.type === "hardBreak") {
      promptText += "\n";
      freeformText += "\n";
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
      } satisfies AiFileReferenceAttrs;

      references.push(attrs);
      promptText += `@${attrs.titleSnapshot}`;
    }
  });

  return { promptText, freeformText };
}

export function serializeAiComposerDoc(content: JSONContent | null | undefined): AiComposerPayload {
  if (!content?.content?.length) {
    return {
      promptText: "",
      freeformText: "",
      references: [],
    };
  }

  const references: AiFileReferenceAttrs[] = [];
  const promptBlocks: string[] = [];
  const freeformBlocks: string[] = [];

  content.content.forEach((block) => {
    if (block.type !== "paragraph") {
      return;
    }

    const inline = collectInlineContent(block.content, references);
    promptBlocks.push(inline.promptText);
    freeformBlocks.push(inline.freeformText);
  });

  return {
    promptText: promptBlocks.join("\n").trim(),
    freeformText: freeformBlocks.join("\n").trim(),
    references,
  };
}

function resolveReferenceLocation(page: Page) {
  const notebook = getNotebookSnapshot(page.workspaceId);
  if (!page.localFilePath) {
    return notebook?.name ?? "未知笔记本";
  }

  return getLocationSnapshot(page);
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
    readStatus: "error",
    errorMessage,
  };
}

export function resolveAiReferenceContexts(references: AiFileReferenceAttrs[]) {
  const { pages } = usePages.getState();
  const { notebooks } = useNotebooks.getState();

  return references.map((reference) => {
    const page = pages[reference.pageId];
    if (!page) {
      return buildFallbackReferenceContext(reference, "引用目标不存在或尚未加载");
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

    return {
      reference,
      title: getPageTitle(page),
      sourceType: getSourceType(page),
      notebookName,
      location: resolveReferenceLocation(page),
      contentText: extractTextFromContent(page.content).trim(),
      readStatus: "ready",
    } satisfies ResolvedAiReferenceContext;
  });
}

export function formatAiReferenceContextBlock(contexts: ResolvedAiReferenceContext[]) {
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
        "内容：",
        context.contentText || "（空白内容）",
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
