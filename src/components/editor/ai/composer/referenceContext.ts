import type { Page } from "@/types";
import type { Notebook } from "@/stores/useNotebooks";
import { getPageTitle } from "@/components/editor/utils/page-title";
import {
  extractStructureSummary,
  extractTextFromContent,
} from "@/components/editor/utils/content-text-extractor";
import type {
  AiFileReferenceAttrs,
  ResolvedAiReferenceContext,
} from "./referenceTypes";
import {
  getNotebookSnapshot,
  getLocationSnapshot,
  getSourceType,
} from "./referenceMetadata";

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
