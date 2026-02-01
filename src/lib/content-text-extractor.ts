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

