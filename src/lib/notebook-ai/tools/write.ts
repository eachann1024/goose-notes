import { tool } from "ai";
import { z } from "zod";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { lookupCreatedPage, reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import {
  createEmptyBlockNoteContent,
  normalizePageContent,
  titleHeadingBlock,
  emptyBlock,
} from "@/components/editor/utils/blocknote-content";
import { importMarkdownFragment } from "@/lib/export/markdown/parse";
import { blocksToMarkdown } from "@/lib/export/blocknoteSerializer";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { JSONContent } from "@/types";

/**
 * 将 markdown 转换为以 H1 标题开头的完整页面 BlockNoteContent。
 * 标题固定为 title，正文内容来自 markdown（跳过第一行如果也是 H1）。
 */
function buildPageContent(title: string, markdown: string): JSONContent {
  // 去掉开头重复的 # 标题行（如果 markdown 第一行就是 # title）
  const stripped = markdown
    .replace(/^\s*#[^\n]*\n?/, "")
    .trim();

  const bodyBlocks = stripped
    ? (importMarkdownFragment(stripped) ?? [emptyBlock()])
    : [emptyBlock()];

  const content: BlockNoteContent = [
    titleHeadingBlock(title),
    ...bodyBlocks,
  ];

  return normalizePageContent(content, { ensureFirstTitle: false }) as JSONContent;
}

// ----------------------------------------------------------------
// createPage
// ----------------------------------------------------------------
export const createPage = tool({
  description:
    "在当前绑定笔记本新建一篇文章并打开它。markdown 参数需包含完整正文内容（首行不要重复标题）；写作类任务必须用这个工具，且 markdown 参数要输出完整文章。",
  inputSchema: z.object({
    title: z.string().describe("文章标题（不含 # 前缀）"),
    markdown: z.string().describe("文章正文，标准 Markdown 格式，首行不要重复标题"),
  }),
  execute: async (input, { experimental_context, toolCallId }) => {
    const { notebookId } = experimental_context as { notebookId: string };

    // 检查 liveWriter 是否已在流式阶段建过该页面（bug 1 fix：避免双重建页）
    const existingPageId = lookupCreatedPage(toolCallId);
    if (existingPageId) {
      // 复用已建页面，只做最终落盘（完整 markdown 写入，标题更新为完整 title）
      const content = buildPageContent(input.title, input.markdown);
      await usePages.getState().writePageContent(
        existingPageId,
        content as JSONContent,
        "replace",
      );
      return { pageId: existingPageId };
    }

    // liveWriter 没有预建页（流式未触发或直接调用），走正常新建路径
    const notebook = useNotebooks.getState().notebooks[notebookId];
    if (!notebook) return { error: `笔记本 ${notebookId} 不存在` };

    const content = buildPageContent(input.title, input.markdown);

    let pageId: string;
    if (notebook.source === "local-folder") {
      // 本地文件夹笔记本走专用路径
      const id = await usePages.getState().createLocalPageRecord({
        workspaceId: notebookId,
        title: input.title,
        content: content as JSONContent,
      });
      if (!id) return { error: "创建本地页面失败" };
      pageId = id;
    } else {
      pageId = usePages.getState().createPageRecord({
        workspaceId: notebookId,
        content: content as JSONContent,
      });
    }

    // 打开新建页面（走 tabs 体系，与侧栏点击同链路）
    useTabs.getState().openTab(pageId);
    useNotebooks.getState().setLastActivePage(notebookId, pageId);

    return { pageId };
  },
});

// ----------------------------------------------------------------
// updatePage
// ----------------------------------------------------------------
export const updatePage = tool({
  description:
    "用新 Markdown 内容整体替换指定页面的正文（保留页面标题）。markdown 参数为完整正文，首行不要包含标题。",
  inputSchema: z.object({
    pageId: z.string().describe("要更新的页面 id"),
    markdown: z
      .string()
      .describe("新的正文内容（Markdown），首行不要包含 # 标题"),
  }),
  execute: async (input) => {
    const page = usePages.getState().pages[input.pageId];
    if (!page) return { error: `页面 ${input.pageId} 不存在` };

    const title = getPageTitle(page);
    const content = buildPageContent(title, input.markdown);

    await usePages.getState().writePageContent(
      input.pageId,
      content as JSONContent,
      "replace",
    );

    return { pageId: input.pageId, ok: true };
  },
});

// ----------------------------------------------------------------
// replaceInPage
// ----------------------------------------------------------------
export const replaceInPage = tool({
  description:
    "在指定页面中精确替换所有匹配文本。找不到时返回 replacedCount=0 而非报错。批量修改任务应逐页调用，并汇报每页替换结果。",
  inputSchema: z.object({
    pageId: z.string().describe("要修改的页面 id"),
    find: z.string().describe("要查找的原始文本（精确匹配）"),
    replace: z.string().describe("替换后的文本"),
  }),
  execute: async (input) => {
    const page = usePages.getState().pages[input.pageId];
    if (!page) return { pageId: input.pageId, replacedCount: 0 };

    // 先序列化为 markdown，做字符串替换，再写回
    const currentMd = await blocksToMarkdown(page.content as BlockNoteContent);
    const count = (currentMd.split(input.find).length - 1);
    if (count === 0) return { pageId: input.pageId, replacedCount: 0 };

    const newMd = currentMd.split(input.find).join(input.replace);
    const title = getPageTitle(page);
    const newContent = buildPageContent(title, newMd);

    await usePages.getState().writePageContent(
      input.pageId,
      newContent as JSONContent,
      "replace",
    );
    reloadEditorIfActive(input.pageId);

    return { pageId: input.pageId, replacedCount: count };
  },
});
