import type { JSONContent, Page } from "@/types";
import { extractBlocksInRange } from "@/lib/ai-block-scope";
import { extractStructureSummary, extractTextFromContent, extractTitleFromContent } from "@/lib/content-text-extractor";
import { importFromMarkdown, importMarkdownFragment, jsonContentToMarkdown } from "@/lib/export";
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
  | "replace_block_range"
  | "create_root_page"
  | "create_child_page";

export interface AiBlockRange {
  startBlockId: string;
  endBlockId: string;
  rangeLabel: string;
  blockCount: number;
}

export type AiTargetMode =
  | "chat_only"
  | "current_page"
  | "current_notebook"
  | "specific_page"
  | "ambiguous";

export type AiTargetSource =
  | "selector"
  | "reference"
  | "session_memory"
  | "prompt_rule"
  | "llm_router";

export interface AiTargetSelection {
  mode: AiTargetMode;
  pageId?: string | null;
  source: AiTargetSource;
}

export interface AiTargetRef extends AiFileReferenceAttrs {
  role: "destination";
}

export interface AiStickyTarget {
  pageId: string;
  workspaceId?: string;
  defaultAction?: "replace_page";
  source: AiTargetSource;
  pageTitle?: string;
  notebookName?: string;
  isLocalFolder?: boolean;
}

export interface AiResolvedTarget {
  mode: AiTargetMode;
  action: AiWriteAction;
  source: AiTargetSource;
  pageId?: string;
  workspaceId?: string;
  parentId?: string;
  targetLabel: string;
  pageTitle?: string;
  notebookName?: string;
  isLocalFolder?: boolean;
  isFolder?: boolean;
  range?: AiBlockRange;
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
// 可视化请求强制走 chat_only，图表只在聊天界面渲染
const DATAVIZ_CHAT_PATTERN = /(图表|折线图|柱状图|饼图|散点图|热力图|面积图|趋势图|可视化|画图|画个图|出个图|对比图|交互式视图|交互视图|echarts|数据图|柱形图|扇形图|曲线图|雷达图)/;
const APPEND_PATTERN =
  /(追加|补充|添加|附加|继续写|续写|补到|加到|append)/;
const CHILD_PATTERN = /(下面|下边|下方|子页面|子页|子文档)/;
const TARGET_VERB_PATTERN =
  /(生成到|写到|写入到|写进|放到|放进|保存到|同步到|落到|输出到|创建到|替换到|覆盖到|改写到|更新到|生成进|写入|替换|覆盖|改写|重写)/;
const CONTEXT_HINT_PATTERN = /(参考|参照|结合|基于|根据|对照|引用|查看|看下|看看|分析)/;
const FOLLOW_UP_EDIT_PATTERN =
  /(再改|继续改|接着改|接着写|再写|改得更|更正式|更口语|更简洁|更自然|缩短一点|短一点|展开一点|扩写一下|润色一下|换个口吻|调整一下|修改一下|优化一下|再来一版|重来一版)/;

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

  // 使用结构摘要替代全文，大幅节省 token
  const summary = extractStructureSummary(page.content);
  if (!summary || summary === "（空白页面）") return "";
  return `${label}：\n${summary}`;
}

function getResolvedPageTarget(
  pageId: string,
  action: AiWriteAction,
  mode: AiTargetMode,
  source: AiTargetSource,
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
      source,
      pageId: page.id,
      parentId: page.id,
      workspaceId: page.workspaceId,
      targetLabel: `在 ${pageTitle} 下新建`,
      pageTitle,
      notebookName: notebook?.name ?? "未知笔记本",
      isLocalFolder,
      isFolder: true,
    };
  }

  return {
    mode,
    action,
    source,
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
  };
}

function createUnavailableSpecificPageTarget(
  pageId: string,
  action: Extract<AiWriteAction, "replace_page" | "append_page">,
  source: AiTargetSource,
): AiResolvedTarget {
  return {
    mode: "specific_page",
    action,
    source,
    pageId,
    targetLabel: action === "append_page" ? "追加到目标页" : "写入目标页",
  } satisfies AiResolvedTarget;
}

export function createAiChatOnlyTarget(source: AiTargetSource = "prompt_rule"): AiResolvedTarget {
  return {
    mode: "chat_only",
    action: "chat_only",
    source,
    targetLabel: "仅聊天",
  } satisfies AiResolvedTarget;
}

export function resolvedTargetToSelection(
  target: AiResolvedTarget | null | undefined,
): AiTargetSelection | null {
  if (!target) return null;

  if (target.mode === "specific_page") {
    if (!target.pageId) return null;
    return {
      mode: "specific_page",
      pageId: target.pageId,
      source: target.source,
    } satisfies AiTargetSelection;
  }

  return {
    mode: target.mode,
    source: target.source,
  } satisfies AiTargetSelection;
}

export function stickyTargetToSelection(
  stickyTarget: AiStickyTarget | null | undefined,
): AiTargetSelection | null {
  if (!stickyTarget?.pageId) return null;
  return {
    mode: "specific_page",
    pageId: stickyTarget.pageId,
    source: "session_memory",
  } satisfies AiTargetSelection;
}

export function createStickyTargetFromResolvedTarget(
  target: AiResolvedTarget | null | undefined,
): AiStickyTarget | null {
  if (!target?.pageId) return null;
  if (target.action !== "replace_page" && target.action !== "append_page") {
    return null;
  }

  return {
    pageId: target.pageId,
    workspaceId: target.workspaceId,
    defaultAction: "replace_page",
    source: target.source === "selector" ? "selector" : "session_memory",
    pageTitle: target.pageTitle,
    notebookName: target.notebookName,
    isLocalFolder: target.isLocalFolder,
  } satisfies AiStickyTarget;
}

function isFollowUpEditPrompt(normalizedPrompt: string) {
  return Boolean(normalizedPrompt) && FOLLOW_UP_EDIT_PATTERN.test(normalizedPrompt);
}

export function resolveAiTargetSelection(params: {
  payload: AiComposerPayload;
  manualSelection?: AiTargetSelection | null;
  stickyTarget?: AiStickyTarget | null;
  recentWriteTarget?: AiTargetSelection | null;
  originPageId?: string | null;
  originNotebookId?: string | null;
}) {
  const { manualSelection, stickyTarget, recentWriteTarget, payload } = params;
  const normalizedPrompt = normalizeSemanticText(
    payload.freeformText || payload.promptText,
  );
  const stickySelection = stickyTargetToSelection(stickyTarget);
  const followUpPrompt = isFollowUpEditPrompt(normalizedPrompt);

  // 优先级 1：显式聊天 / 可视化请求
  if (EXPLICIT_CHAT_PATTERN.test(normalizedPrompt) || DATAVIZ_CHAT_PATTERN.test(normalizedPrompt)) {
    return {
      mode: "chat_only",
      source: "prompt_rule",
    } satisfies AiTargetSelection;
  }

  // 优先级 2：目标引用
  const destinationRef = detectDestinationReference(payload);
  if (destinationRef) {
    return {
      mode: "specific_page",
      pageId: destinationRef.pageId,
      source: "reference",
    } satisfies AiTargetSelection;
  }

  // 优先级 3：手动选择（保留给程序化调用）
  if (manualSelection?.mode === "specific_page" && manualSelection.pageId) {
    return {
      mode: "specific_page",
      pageId: manualSelection.pageId,
      source: "selector",
    } satisfies AiTargetSelection;
  }

  if (manualSelection) {
    return {
      ...manualSelection,
      source: "selector",
    } satisfies AiTargetSelection;
  }

  // 优先级 4：follow-up 编辑 + 最近写入目标 / stickyTarget
  if (followUpPrompt && recentWriteTarget?.mode === "specific_page" && recentWriteTarget.pageId) {
    return {
      mode: "specific_page",
      pageId: recentWriteTarget.pageId,
      source: "session_memory",
    } satisfies AiTargetSelection;
  }

  if (followUpPrompt && stickySelection?.pageId) {
    return {
      mode: "specific_page",
      pageId: stickySelection.pageId,
      source: "session_memory",
    } satisfies AiTargetSelection;
  }

  // 优先级 5：模糊场景交给 LLM
  return {
    mode: "ambiguous",
    source: "prompt_rule",
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
    return createAiChatOnlyTarget(selection.source);
  }

  if (selection.mode === "current_notebook") {
    const notebookId = originNotebookId;
    const notebook = notebookId
      ? useNotebooks.getState().notebooks[notebookId]
      : undefined;
    return {
      mode: "current_notebook",
      action: "create_root_page",
      source: selection.source,
      workspaceId: notebookId ?? undefined,
      targetLabel: notebook ? `在 ${notebook.name} 中新建` : "在当前笔记本中新建",
      notebookName: notebook?.name ?? "当前笔记本",
      isLocalFolder: notebook?.source === "local-folder",
    } satisfies AiResolvedTarget;
  }

  if (selection.mode === "specific_page" && selection.pageId) {
    const targetPage = usePages.getState().pages[selection.pageId];
    if (!targetPage) {
      return createUnavailableSpecificPageTarget(
        selection.pageId,
        wantsAppend ? "append_page" : "replace_page",
        selection.source,
      );
    }

    if (targetPage.isFolder || wantsChild) {
      return getResolvedPageTarget(
        targetPage.id,
        "create_child_page",
        "specific_page",
        selection.source,
      )!;
    }

    return getResolvedPageTarget(
      targetPage.id,
      wantsAppend ? "append_page" : "replace_page",
      "specific_page",
      selection.source,
    )!;
  }

  if (originPageId) {
    return getResolvedPageTarget(
      originPageId,
      wantsAppend ? "append_page" : "replace_page",
      "current_page",
      selection.source,
    )!;
  }

  return createAiChatOnlyTarget(selection.source);
}

export function resolveAiTargetFromSelection(params: {
  selection: AiTargetSelection;
  originPageId?: string | null;
  originNotebookId?: string | null;
}) {
  return resolveAiTargetIntent({
    payload: {
      promptText: "",
      freeformText: "",
      references: [],
      tokens: [],
    },
    selection: params.selection,
    originPageId: params.originPageId,
    originNotebookId: params.originNotebookId,
  });
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
    case "replace_block_range":
      return `写入目标：仅替换页面「${resolvedTarget.pageTitle || "当前页面"}」中「${resolvedTarget.range?.rangeLabel ?? "指定范围"}」对应的 ${resolvedTarget.range?.blockCount ?? "若干"} 个块。只输出替换后的 Markdown 片段，不要包含一级标题，不要解释，不要使用代码围栏。可以根据需要把内容调整为段落、有序/无序列表、二级及以下标题等结构。`;
    case "create_root_page":
      return `写入目标：在笔记本「${resolvedTarget.notebookName || "当前笔记本"}」根目录创建新页面。请输出完整 Markdown 页面，第一行必须是一级标题作为页面标题。不要解释，不要使用代码围栏。`;
    case "create_child_page":
      return `写入目标：在「${resolvedTarget.pageTitle || "目标页面"}」下面创建新页面。请输出完整 Markdown 页面，第一行必须是一级标题作为页面标题。不要解释，不要使用代码围栏。`;
    default:
      return "";
  }
}

function getRangeContextBlock(resolvedTarget: AiResolvedTarget): string {
  if (resolvedTarget.action !== "replace_block_range") return "";
  if (!resolvedTarget.pageId || !resolvedTarget.range) return "";
  const page = usePages.getState().pages[resolvedTarget.pageId];
  if (!page) return "";
  const blocks = Array.isArray(page.content)
    ? (page.content as any[])
    : Array.isArray((page.content as any)?.content)
      ? ((page.content as any).content as any[])
      : [];
  const slice = extractBlocksInRange(
    blocks,
    resolvedTarget.range.startBlockId,
    resolvedTarget.range.endBlockId,
  );
  if (!slice?.length) return "";
  const markdown = jsonContentToMarkdown(slice as any).trim();
  if (!markdown) return "";
  return `以下是要重写的区段（${resolvedTarget.range.rangeLabel} · 共 ${resolvedTarget.range.blockCount} 块）：\n${markdown}`;
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
    getRangeContextBlock(params.resolvedTarget),
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

  if (params.resolvedTarget.action === "replace_block_range") {
    const fragment = importMarkdownFragment(params.markdown);
    const fragmentContent: JSONContent | null =
      fragment && fragment.length ? (cloneContent(fragment) as JSONContent) : null;
    const fallbackContent =
      fragmentContent ?? createPlainTextDoc(params.markdown);
    const previewTitle =
      params.resolvedTarget.range?.rangeLabel
        ? `重写：${params.resolvedTarget.range.rangeLabel}`
        : "重写选中范围";

    return {
      action: params.resolvedTarget.action,
      target: params.resolvedTarget,
      promptText: params.promptText,
      outputMarkdown: params.markdown.trim(),
      previewTitle,
      content: fallbackContent,
      status: "pending",
    } satisfies AiWritePlan;
  }

  const imported = importFromMarkdown(params.markdown);
  let content =
    imported.success && imported.content.length
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

  if (plan.action === "replace_block_range") {
    if (!plan.target.pageId || !plan.target.range) return null;
    const fragment = Array.isArray(plan.content)
      ? (plan.content as any[])
      : Array.isArray((plan.content as any)?.content)
        ? ((plan.content as any).content as any[])
        : [];
    if (!fragment.length) return null;
    const ok = await pagesStore.replaceBlockRange(
      plan.target.pageId,
      plan.target.range.startBlockId,
      plan.target.range.endBlockId,
      fragment as any,
    );
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
