import type { JSONContent } from '@tiptap/core'

/**
 * 从 TipTap JSONContent 中提取纯文本，用于搜索
 *
 * @example
 * extractTextFromContent({ type: 'doc', content: [
 *   { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }
 * ]})
 * // => 'Hello'
 */
export function extractTextFromContent(content: JSONContent): string {
  if (!content) return ''

  const texts: string[] = []

  function traverse(node: JSONContent) {
    // 提取文本节点
    if (node.text) {
      texts.push(node.text)
    }

    // 递归处理子节点
    if (node.content && node.content.length > 0) {
      for (const child of node.content) {
        traverse(child)
      }
    }
  }

  traverse(content)
  return texts.join(' ').trim()
}

/**
 * 从 TipTap content 中提取标题（第一个 h1 节点的文本）
 */
export function extractTitleFromContent(content: JSONContent): string {
  if (!content || !content.content || content.content.length === 0) {
    return '无标题'
  }

  const firstNode = content.content[0]
  
  if (firstNode.type === 'heading' && firstNode.attrs?.level === 1) {
    const titleText = extractTextFromContent(firstNode)
    return titleText || '无标题'
  }

  return '无标题'
}

/**
 * 提取页面结构摘要，用于 AI 上下文（替代全文注入以节省 token）
 *
 * 输出格式：
 * - 标题（h1）
 * - 段落标题列表（h2/h3）
 * - 前几段的开头摘要（各截取 summaryMaxChars 字）
 * - 总字数
 */
export function extractStructureSummary(
  content: JSONContent,
  options?: {
    summaryMaxChars?: number;
    maxSummaryParagraphs?: number;
  },
): string {
  const summaryMaxChars = options?.summaryMaxChars ?? 120;
  const maxSummaryParagraphs = options?.maxSummaryParagraphs ?? 3;

  if (!content?.content?.length) return "（空白页面）";

  const headings: string[] = [];
  const summaries: string[] = [];
  let summaryCount = 0;
  let wordCount = 0;

  for (const block of content.content) {
    // 提取标题
    if (block.type === "heading" && block.attrs?.level) {
      const headingText = extractTextFromContent(block).trim();
      if (headingText) {
        headings.push(`${"#".repeat(block.attrs.level)} ${headingText}`);
      }
      continue;
    }

    // 提取前几段摘要
    if (
      block.type === "paragraph" &&
      summaryCount < maxSummaryParagraphs
    ) {
      const text = extractTextFromContent(block).trim();
      if (text) {
        const totalWords = countWords(block);
        wordCount += totalWords;
        const snippet =
          text.length > summaryMaxChars
            ? `${text.slice(0, summaryMaxChars)}...`
            : text;
        summaries.push(snippet);
        summaryCount += 1;
        continue;
      }
    }

    // 统计其他块的文字
    if (block.content) {
      wordCount += countWords(block);
    }
  }

  const parts: string[] = [];
  if (headings.length > 0) {
    parts.push(`段落结构：\n${headings.join("\n")}`);
  }
  if (summaries.length > 0) {
    parts.push(`内容摘要：\n${summaries.join("\n")}`);
  }
  parts.push(`总字数：约 ${wordCount} 字`);

  return parts.join("\n\n");
}

/**
 * 统计字数
 * - 中文字符：每个算 1 字
 * - 英文单词：每个算 1 字
 * - 连续数字：算 1 字
 */
export function countWords(content: JSONContent): number {
  const text = extractTextFromContent(content)
  if (!text) return 0

  // 匹配中文字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || []
  // 匹配英文单词
  const englishWords = text.match(/[a-zA-Z]+/g) || []
  // 匹配连续数字
  const numberGroups = text.match(/\d+/g) || []

  return chineseChars.length + englishWords.length + numberGroups.length
}

