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
