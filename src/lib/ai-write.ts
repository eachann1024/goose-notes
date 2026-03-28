import type { JSONContent, Page } from "@/types";
import { extractTextFromContent, extractTitleFromContent } from "@/lib/content-text-extractor";
import { importFromMarkdown } from "@/lib/export";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import {
  buildAiFileReferenceAttrs,
  formatAiReferenceContextBlock,
  resolveAiReferenceContexts,
  type AiComposerPayload,
  type AiComposerToken,
  type AiFileReferenceAttrs,
} from "@/pages/workspace/components/editor/ai-composer/referenceLookup";

export type AiWriteAction =
  | "chat_only"
  | "replace_page"
  | "append_page"
  | "create_root_page"
  | "create_child_page";

export type AiTargetMode =
  | "chat_only"
  | "current_page"
  | "current_notebook"
  | "specific_page";

export interface AiTargetSelection {
  mode: AiTargetMode;
  pageId?: string | null;
  manual?: boolean;
}

export interface AiTargetRef extends AiFileReferenceAttrs {
  role: "destination";
}

export interface AiResolvedTarget {
  mode: AiTargetMode;
  action: AiWriteAction;
  pageId?: string;
  workspaceId?: string;
  parentId?: string;
  targetLabel: string;
  pageTitle?: string;
  notebookName?: string;
  isLocalFolder?: boolean;
  isFolder?: boolean;
  manual?: boolean;
}

export interface AiWritePlan {
  action: Exclude<AiWriteAction, "chat_only">;
  target: AiResolvedTarget;
  promptText: string;
  outputMarkdown: string;
  previewTitle: string;
  content: JSONContent;
  status?: "pending" | "committed" | "cancelled";
  committedPageId?: string;
}

export interface AiContextBundle {
  originPageId?: string | null;
  originNotebookId?: string | null;
  referenceContextBlock: string;
  originContextBlock: string;
  targetContextBlock: string;
}

const EXPLICIT_CHAT_PATTERN = /(仅聊天|只聊天|只回答|不要写入|不要落盘|仅回复|只讨论)/;
const CURRENT_NOTEBOOK_PATTERN = /((当前|这个|本)(笔记本|记事本))/;
const CURRENT_PAGE_PATTERN = /((当前|这|本)(页|个页面|篇|份|段内容)|本文|这篇内容|这份内容)/;
const APPEND_PATTERN =
  /(追加|补充|添加|附加|继续写|续写|补到|加到|append)/;
const CHILD_PATTERN = /(下面|下边|下方|子页面|子页|子文档)/;
const PAGE_EDIT_PATTERN =
  /(润色|改写|重写|续写|扩写|精简|压缩|翻译|补充|完善|整理|优化|提炼|总结|改成|改写成)/;
const ROOT_GENERATION_PATTERN =
  /(帮我生成|给我生成|生成一(篇|份|个|套)|写一(篇|份|个|套)|帮我写|给我写|起草|拟一份|做一份|产出一份|整理成一(篇|份|个)|输出一(篇|份|个)|来一(篇|份|个)|小红书|抖音|公众号|朋友圈|视频脚本|口播稿|直播脚本|文案|脚本|方案|提纲|清单|周报|纪要|发言稿|演讲稿|邮件|推文|笔记)/;
const QUESTION_PATTERN =
  /(什么|怎么|为什么|是否|能否|可不可以|有哪些|有啥|区别|解释|怎么看|帮我看|请问|\?|？)/;
const TARGET_VERB_PATTERN =
  /(生成到|写到|写入到|写进|放到|放进|保存到|同步到|落到|输出到|创建到|替换到|覆盖到|改写到|更新到|生成进|写入|替换|覆盖|改写|重写)/;
const CONTEXT_HINT_PATTERN = /(参考|参照|结合|基于|根据|对照|引用|查看|看下|看看|分析)/;

function cloneContent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSemanticText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function collectNeighborText(
  tokens: AiComposerToken[],
  index: number,
  direction: "before" | "after",
  maxLength = 18,
) {
  const pieces: string[] = [];
  let remaining = maxLength;
  let cursor = direction === "before" ? index - 1 : index + 1;

  while (cursor >= 0 && cursor < tokens.length && remaining > 0) {
    const token = tokens[cursor];
    const text = token.type === "text" ? token.text : `@${token.reference.titleSnapshot}`;
    if (text) {
      const slice =
        direction === "before"
          ? text.slice(Math.max(0, text.length - remaining))
          : text.slice(0, remaining);
      if (direction === "before") {
        pieces.unshift(slice);
      } else {
        pieces.push(slice);
      }
      remaining -= slice.length;
    }
    cursor += direction === "before" ? -1 : 1;
  }

  return pieces.join("");
}

export function resolveAiTargetReference(payload: AiComposerPayload): {
  reference: AiTargetRef;
  tokenIndex: number;
} | null {
  for (let index = 0; index < payload.tokens.length; index += 1) {
    const token = payload.tokens[index];
    if (token.type !== "reference") continue;

    const before = normalizeSemanticText(collectNeighborText(payload.tokens, index, "before"));
    const after = normalizeSemanticText(collectNeighborText(payload.tokens, index, "after"));

    if (CONTEXT_HINT_PATTERN.test(before) && !TARGET_VERB_PATTERN.test(before)) {
      continue;
    }

    const hasTargetCue =
      TARGET_VERB_PATTERN.test(before) ||
      APPEND_PATTERN.test(before) ||
      CHILD_PATTERN.test(after);

    if (!hasTargetCue) {
      continue;
    }

    return {
      tokenIndex: index,
      reference: {
        ...token.reference,
        role: "destination",
      },
    };
  }

  return null;
}

function detectDestinationReference(payload: AiComposerPayload): AiTargetRef | null {
  return resolveAiTargetReference(payload)?.reference ?? null;
}

function getPageContextBlock(page: Page | undefined, label: string) {
  if (!page || page.isFolder) return "";

  const context = resolveAiReferenceContexts([buildAiFileReferenceAttrs(page)]);
  const content = formatAiReferenceContextBlock(context);
  if (!content) return "";
  return `${label}：\n${content}`;
}

function getResolvedPageTarget(
  pageId: string,
  action: AiWriteAction,
  mode: AiTargetMode,
  manual = false,
): AiResolvedTarget | null {
  const page = usePages.getState().pages[pageId];
  if (!page) return null;

  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const pageTitle = getPageTitle(page);

  if (page.isFolder) {
    return {
      mode,
      action: "create_child_page",
      pageId: page.id,
      parentId: page.id,
      workspaceId: page.workspaceId,
      targetLabel: `在 ${pageTitle} 下新建`,
      pageTitle,
      notebookName: notebook?.name ?? "未知笔记本",
      isLocalFolder,
      isFolder: true,
      manual,
    };
  }

  return {
    mode,
    action,
    pageId: page.id,
    workspaceId: page.workspaceId,
    targetLabel:
      action === "append_page"
        ? `追加到 ${pageTitle}`
        : `写入 ${pageTitle}`,
    pageTitle,
    notebookName: notebook?.name ?? "未知笔记本",
    isLocalFolder,
    isFolder: false,
    manual,
  };
}

export function createAiChatOnlyTarget(manual = false): AiResolvedTarget {
  return {
    mode: "chat_only",
    action: "chat_only",
    targetLabel: "仅聊天",
    manual,
  } satisfies AiResolvedTarget;
}

export function resolveAiTargetSelection(params: {
  payload: AiComposerPayload;
  manualSelection?: AiTargetSelection | null;
  originPageId?: string | null;
  originNotebookId?: string | null;
}) {
  const { manualSelection, payload, originPageId, originNotebookId } = params;
  if (manualSelection?.mode === "specific_page" && manualSelection.pageId) {
    return {
      mode: "specific_page",
      pageId: manualSelection.pageId,
      manual: true,
    } satisfies AiTargetSelection;
  }

  if (manualSelection) {
    return {
      ...manualSelection,
      manual: true,
    } satisfies AiTargetSelection;
  }

  const normalizedPrompt = normalizeSemanticText(
    payload.freeformText || payload.promptText,
  );

  if (EXPLICIT_CHAT_PATTERN.test(normalizedPrompt)) {
    return {
      mode: "chat_only",
      manual: false,
    } satisfies AiTargetSelection;
  }

  const destinationRef = detectDestinationReference(payload);
  if (destinationRef) {
    return {
      mode: "specific_page",
      pageId: destinationRef.pageId,
      manual: false,
    } satisfies AiTargetSelection;
  }

  if (CURRENT_NOTEBOOK_PATTERN.test(normalizedPrompt) && TARGET_VERB_PATTERN.test(normalizedPrompt)) {
    return {
      mode: "current_notebook",
      manual: false,
    } satisfies AiTargetSelection;
  }

  if (CURRENT_PAGE_PATTERN.test(normalizedPrompt)) {
    return {
      mode: originPageId ? "current_page" : originNotebookId ? "current_notebook" : "chat_only",
      manual: false,
    } satisfies AiTargetSelection;
  }

  if (
    originPageId &&
    PAGE_EDIT_PATTERN.test(normalizedPrompt) &&
    !ROOT_GENERATION_PATTERN.test(normalizedPrompt)
  ) {
    return {
      mode: "current_page",
      manual: false,
    } satisfies AiTargetSelection;
  }

  if (QUESTION_PATTERN.test(normalizedPrompt) && !ROOT_GENERATION_PATTERN.test(normalizedPrompt)) {
    return {
      mode: "chat_only",
      manual: false,
    } satisfies AiTargetSelection;
  }

  if (originNotebookId && ROOT_GENERATION_PATTERN.test(normalizedPrompt)) {
    return {
      mode: "current_notebook",
      manual: false,
    } satisfies AiTargetSelection;
  }

  return {
    mode: originNotebookId ? "current_notebook" : originPageId ? "current_page" : "chat_only",
    manual: false,
  } satisfies AiTargetSelection;
}

export function resolveAiTargetIntent(params: {
  payload: AiComposerPayload;
  selection: AiTargetSelection;
  originPageId?: string | null;
  originNotebookId?: string | null;
}) {
  const { payload, selection, originPageId, originNotebookId } = params;
  const normalizedPrompt = normalizeSemanticText(
    payload.freeformText || payload.promptText,
  );
  const wantsAppend = APPEND_PATTERN.test(normalizedPrompt);
  const wantsChild = CHILD_PATTERN.test(normalizedPrompt);

  if (selection.mode === "chat_only") {
    return createAiChatOnlyTarget(selection.manual);
  }

  if (selection.mode === "current_notebook") {
    const notebookId = originNotebookId;
    const notebook = notebookId
      ? useNotebooks.getState().notebooks[notebookId]
      : undefined;
    return {
      mode: "current_notebook",
      action: "create_root_page",
      workspaceId: notebookId ?? undefined,
      targetLabel: notebook ? `在 ${notebook.name} 中新建` : "在当前笔记本中新建",
      notebookName: notebook?.name ?? "当前笔记本",
      isLocalFolder: notebook?.source === "local-folder",
      manual: selection.manual,
    } satisfies AiResolvedTarget;
  }

  if (selection.mode === "specific_page" && selection.pageId) {
    const targetPage = usePages.getState().pages[selection.pageId];
    if (!targetPage) {
      return resolveAiTargetIntent({
        payload,
        selection: {
          mode: originPageId ? "current_page" : "chat_only",
          manual: selection.manual,
        },
        originPageId,
        originNotebookId,
      });
    }

    if (targetPage.isFolder || wantsChild) {
      return getResolvedPageTarget(
        targetPage.id,
        "create_child_page",
        "specific_page",
        Boolean(selection.manual),
      )!;
    }

    return getResolvedPageTarget(
      targetPage.id,
      wantsAppend ? "append_page" : "replace_page",
      "specific_page",
      Boolean(selection.manual),
    )!;
  }

  if (originPageId) {
    return getResolvedPageTarget(
      originPageId,
      wantsAppend ? "append_page" : "replace_page",
      "current_page",
      Boolean(selection.manual),
    )!;
  }

  return {
    ...createAiChatOnlyTarget(selection.manual),
    manual: selection.manual,
  } satisfies AiResolvedTarget;
}

function createPlainTextDoc(text: string, title?: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      type: "paragraph",
      content: [{ type: "text", text: item }],
    }));

  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        ...(title
          ? {
              content: [{ type: "text", text: title }],
            }
          : {}),
      },
      ...paragraphs,
    ],
  } satisfies JSONContent;
}

function setTitleOnContent(content: JSONContent, title: string) {
  const next = cloneContent(content);
  const blocks = next.content ?? [];
  const titleBlock = {
    type: "heading",
    attrs: { level: 1 },
    content: [{ type: "text", text: title }],
  } satisfies JSONContent;

  if (blocks[0]?.type === "heading" && blocks[0].attrs?.level === 1) {
    blocks[0] = titleBlock;
  } else {
    blocks.unshift(titleBlock);
  }

  next.content = blocks;
  return next;
}

function stripLeadingTitle(content: JSONContent) {
  const next = cloneContent(content);
  const blocks = next.content ?? [];
  if (blocks[0]?.type === "heading" && blocks[0].attrs?.level === 1) {
    next.content = blocks.slice(1);
  }
  return next;
}

function inferTitleFromContent(content: JSONContent, fallback = "AI 生成") {
  const title = extractTitleFromContent(content).trim();
  if (title && title !== "无标题") return title;

  const fallbackText = extractTextFromContent(content)
    .split(/\n+/)
    .map((item) => item.trim())
    .find(Boolean);
  return (fallbackText || fallback).slice(0, 40) || fallback;
}

export function buildAiContextBundle(params: {
  payload: AiComposerPayload;
  resolvedTarget: AiResolvedTarget;
  originPageId?: string | null;
}) {
  const destinationPageId =
    params.resolvedTarget.action === "replace_page" ||
    params.resolvedTarget.action === "append_page"
      ? params.resolvedTarget.pageId
      : params.resolvedTarget.action === "create_child_page"
        ? params.resolvedTarget.parentId
        : undefined;

  const filteredReferences = params.payload.references.filter(
    (reference) => reference.pageId !== destinationPageId,
  );

  return {
    referenceContextBlock: formatAiReferenceContextBlock(
      resolveAiReferenceContexts(filteredReferences),
    ),
    originContextBlock: getPageContextBlock(
      params.originPageId
        ? usePages.getState().pages[params.originPageId]
        : undefined,
      "当前页面内容",
    ),
    targetContextBlock: getPageContextBlock(
      destinationPageId
        ? usePages.getState().pages[destinationPageId]
        : undefined,
      params.resolvedTarget.action === "create_child_page"
        ? "父页面内容"
        : "目标页面当前内容",
    ),
  } satisfies AiContextBundle;
}

function getWriteInstruction(resolvedTarget: AiResolvedTarget) {
  switch (resolvedTarget.action) {
    case "replace_page":
      return `写入目标：替换页面「${resolvedTarget.pageTitle || "当前页面"}」的全部内容。请输出完整 Markdown 页面内容，第一行必须是一级标题。不要解释，不要使用代码围栏。`;
    case "append_page":
      return `写入目标：把内容追加到页面「${resolvedTarget.pageTitle || "当前页面"}」末尾。请输出用于追加的 Markdown 片段，不要以一级标题开头。不要解释，不要使用代码围栏。`;
    case "create_root_page":
      return `写入目标：在笔记本「${resolvedTarget.notebookName || "当前笔记本"}」根目录创建新页面。请输出完整 Markdown 页面，第一行必须是一级标题作为页面标题。不要解释，不要使用代码围栏。`;
    case "create_child_page":
      return `写入目标：在「${resolvedTarget.pageTitle || "目标页面"}」下面创建新页面。请输出完整 Markdown 页面，第一行必须是一级标题作为页面标题。不要解释，不要使用代码围栏。`;
    default:
      return "";
  }
}

export function buildAiWorkspaceUserPrompt(params: {
  promptText: string;
  resolvedTarget: AiResolvedTarget;
  contextBundle: AiContextBundle;
}) {
  if (params.resolvedTarget.action === "chat_only") {
    return [
      "用户问题：",
      params.promptText,
      params.contextBundle.originContextBlock,
      params.contextBundle.referenceContextBlock
        ? `补充上下文：\n${params.contextBundle.referenceContextBlock}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    "用户需求：",
    params.promptText,
    getWriteInstruction(params.resolvedTarget),
    params.contextBundle.originContextBlock,
    params.contextBundle.targetContextBlock,
    params.contextBundle.referenceContextBlock
      ? `补充上下文：\n${params.contextBundle.referenceContextBlock}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildAiWritePlan(params: {
  markdown: string;
  promptText: string;
  resolvedTarget: AiResolvedTarget;
}) {
  if (params.resolvedTarget.action === "chat_only") return null;

  const imported = importFromMarkdown(params.markdown);
  let content =
    imported.success && imported.content.content?.length
      ? cloneContent(imported.content)
      : createPlainTextDoc(params.markdown);

  let previewTitle = inferTitleFromContent(content);

  if (params.resolvedTarget.action === "replace_page") {
    previewTitle = params.resolvedTarget.pageTitle || previewTitle;
    content = setTitleOnContent(content, previewTitle);
  } else if (params.resolvedTarget.action === "append_page") {
    previewTitle = params.resolvedTarget.pageTitle || previewTitle;
    content = stripLeadingTitle(content);
  } else {
    previewTitle = inferTitleFromContent(content, previewTitle);
    content = setTitleOnContent(content, previewTitle);
  }

  return {
    action: params.resolvedTarget.action,
    target: params.resolvedTarget,
    promptText: params.promptText,
    outputMarkdown: params.markdown.trim(),
    previewTitle,
    content,
    status: "pending",
  } satisfies AiWritePlan;
}

export async function commitAiWritePlan(plan: AiWritePlan) {
  const pagesStore = usePages.getState();

  if (plan.action === "replace_page") {
    if (!plan.target.pageId) return null;
    const ok = await pagesStore.writePageContent(plan.target.pageId, plan.content);
    if (!ok) return null;
    return {
      pageId: plan.target.pageId,
      workspaceId: plan.target.workspaceId,
    };
  }

  if (plan.action === "append_page") {
    if (!plan.target.pageId) return null;
    const ok = await pagesStore.appendPageContent(plan.target.pageId, plan.content);
    if (!ok) return null;
    return {
      pageId: plan.target.pageId,
      workspaceId: plan.target.workspaceId,
    };
  }

  const workspaceId = plan.target.workspaceId;
  if (!workspaceId) return null;

  const title = inferTitleFromContent(plan.content, plan.previewTitle);
  const notebook = useNotebooks.getState().notebooks[workspaceId];
  const parentId =
    plan.action === "create_child_page"
      ? plan.target.parentId
      : undefined;

  if (notebook?.source === "local-folder") {
    const pageId = await pagesStore.createLocalPageRecord({
      workspaceId,
      parentId,
      title,
      content: plan.content,
    });
    if (!pageId) return null;
    return {
      pageId,
      workspaceId,
    };
  }

  const pageId = pagesStore.createPageRecord({
    workspaceId,
    parentId,
    content: plan.content,
  });

  return {
    pageId,
    workspaceId,
  };
}
