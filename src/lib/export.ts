
import type { Page, JSONContent } from '@/types'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'

// Extensions used for HTML generation (must match editor extensions)
const extensions = [
  StarterKit,
  Link,
  TaskList,
  TaskItem,
  Image,
  Highlight,
]

// ==================== EXPORT ====================

export function exportToJSON(page: Page) {
  const data = JSON.stringify(page, null, 2)
  downloadFile(data, `${page.title || 'untitled'}.json`, 'application/json')
}

export function exportToMarkdown(page: Page) {
  const content = page.content as JSONContent
  const markdown = jsonContentToMarkdown(content)
  const fullMarkdown = `# ${page.title || '无标题'}\n\n${markdown}`
  downloadFile(fullMarkdown, `${page.title || 'untitled'}.md`, 'text/markdown')
}

export function exportToHTML(page: Page) {
  const html = generateHTML(page.content, extensions)
  const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${page.title}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
img { max-width: 100%; height: auto; }
blockquote { border-left: 3px solid #ccc; padding-left: 1rem; color: #666; }
code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 3px; }
pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
</style>
</head>
<body>
<h1>${page.title}</h1>
${html}
</body>
</html>`
  
  downloadFile(fullHtml, `${page.title || 'untitled'}.html`, 'text/html')
}

// ==================== IMPORT ====================

export interface ImportResult {
  title: string
  content: JSONContent
  success: boolean
  error?: string
}

// 从 JSON 导入
export function importFromJSON(jsonString: string): ImportResult {
  try {
    const data = JSON.parse(jsonString) as Page
    
    // 验证必要字段
    if (!data.content || typeof data.content !== 'object') {
      return { title: '', content: { type: 'doc', content: [] }, success: false, error: '无效的 JSON 格式：缺少 content 字段' }
    }
    
    return {
      title: data.title || '导入的页面',
      content: data.content,
      success: true,
    }
  } catch (e) {
    return { title: '', content: { type: 'doc', content: [] }, success: false, error: '解析 JSON 失败' }
  }
}

// 从 Markdown 导入
export function importFromMarkdown(markdown: string): ImportResult {
  try {
    const content = markdownToJsonContent(markdown)
    
    // 从第一个 H1 提取标题
    let title = '导入的页面'
    const h1Match = markdown.match(/^#\s+(.+)$/m)
    if (h1Match) {
      title = h1Match[1].trim()
    }
    
    return { title, content, success: true }
  } catch (e) {
    return { title: '', content: { type: 'doc', content: [] }, success: false, error: '解析 Markdown 失败' }
  }
}

// 通用文件导入
export function importFile(): Promise<ImportResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.md,.markdown,.txt'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve({ title: '', content: { type: 'doc', content: [] }, success: false, error: '未选择文件' })
        return
      }
      
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase()
      
      if (ext === 'json') {
        resolve(importFromJSON(text))
      } else if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
        resolve(importFromMarkdown(text))
      } else {
        resolve({ title: '', content: { type: 'doc', content: [] }, success: false, error: '不支持的文件格式' })
      }
    }
    
    input.click()
  })
}

// ==================== HELPERS ====================

function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// JSONContent 转 Markdown
function jsonContentToMarkdown(content: JSONContent): string {
  if (!content.content) return ''
  
  return content.content.map((node) => nodeToMarkdown(node)).join('\n')
}

function nodeToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return inlineContentToMarkdown(node.content) + '\n'
    
    case 'heading': {
      const level = node.attrs?.level || 1
      return '#'.repeat(level) + ' ' + inlineContentToMarkdown(node.content) + '\n'
    }
    
    case 'bulletList':
      return node.content?.map((item) => '- ' + listItemContent(item)).join('\n') + '\n'
    
    case 'orderedList':
      return node.content?.map((item, i) => `${i + 1}. ` + listItemContent(item)).join('\n') + '\n'
    
    case 'taskList':
      return node.content?.map((item) => {
        const checked = item.attrs?.checked ? 'x' : ' '
        return `- [${checked}] ` + listItemContent(item)
      }).join('\n') + '\n'
    
    case 'blockquote':
      return '> ' + jsonContentToMarkdown(node).trim().split('\n').join('\n> ') + '\n'
    
    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      return '```' + lang + '\n' + (node.content?.[0]?.text || '') + '\n```\n'
    }
    
    case 'horizontalRule':
      return '---\n'
    
    case 'image':
      return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})\n`
    
    default:
      return inlineContentToMarkdown(node.content) + '\n'
  }
}

function listItemContent(item: JSONContent): string {
  const paragraphs = item.content?.filter(c => c.type === 'paragraph') || []
  return paragraphs.map(p => inlineContentToMarkdown(p.content)).join(' ')
}

function inlineContentToMarkdown(content?: JSONContent[]): string {
  if (!content) return ''
  
  return content.map((node) => {
    let text = node.text || ''
    
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`
            break
          case 'italic':
            text = `*${text}*`
            break
          case 'strike':
            text = `~~${text}~~`
            break
          case 'code':
            text = `\`${text}\``
            break
          case 'link':
            text = `[${text}](${mark.attrs?.href || ''})`
            break
        }
      }
    }
    
    return text
  }).join('')
}

// Markdown 转 JSONContent
function markdownToJsonContent(markdown: string): JSONContent {
  const lines = markdown.split('\n')
  const content: JSONContent[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      content.push({
        type: 'codeBlock',
        attrs: { language: lang },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      })
      i++
      continue
    }
    
    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2])
      })
      i++
      continue
    }
    
    // 水平线
    if (line.match(/^---+$/)) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }
    
    // 引用
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInlineMarkdown(quoteLines.join(' '))
        }]
      })
      continue
    }
    
    // 任务列表
    const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/)
    if (taskMatch) {
      const items: JSONContent[] = []
      while (i < lines.length) {
        const tm = lines[i].match(/^-\s+\[([ x])\]\s+(.+)$/)
        if (!tm) break
        items.push({
          type: 'taskItem',
          attrs: { checked: tm[1] === 'x' },
          content: [{ type: 'paragraph', content: parseInlineMarkdown(tm[2]) }]
        })
        i++
      }
      content.push({ type: 'taskList', content: items })
      continue
    }
    
    // 无序列表
    if (line.match(/^-\s+/)) {
      const items: JSONContent[] = []
      while (i < lines.length && lines[i].match(/^-\s+/)) {
        const text = lines[i].replace(/^-\s+/, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlineMarkdown(text) }]
        })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }
    
    // 有序列表
    if (line.match(/^\d+\.\s+/)) {
      const items: JSONContent[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const text = lines[i].replace(/^\d+\.\s+/, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlineMarkdown(text) }]
        })
        i++
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }
    
    // 图片
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      content.push({
        type: 'image',
        attrs: { src: imgMatch[2], alt: imgMatch[1] }
      })
      i++
      continue
    }
    
    // 普通段落
    if (line.trim()) {
      content.push({
        type: 'paragraph',
        content: parseInlineMarkdown(line)
      })
    } else if (content.length > 0 && content[content.length - 1].type !== 'paragraph') {
      // 空行，添加空段落
      content.push({ type: 'paragraph' })
    }
    i++
  }
  
  return { type: 'doc', content }
}

function parseInlineMarkdown(text: string): JSONContent[] {
  const result: JSONContent[] = []
  
  // 简单的正则解析内联标记
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match
  
  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的普通文本
    if (match.index > lastIndex) {
      result.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    
    if (match[2]) {
      // 粗体 **text**
      result.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
    } else if (match[3]) {
      // 斜体 *text*
      result.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] })
    } else if (match[4]) {
      // 删除线 ~~text~~
      result.push({ type: 'text', text: match[4], marks: [{ type: 'strike' }] })
    } else if (match[5]) {
      // 行内代码 `text`
      result.push({ type: 'text', text: match[5], marks: [{ type: 'code' }] })
    } else if (match[6] && match[7]) {
      // 链接 [text](url)
      result.push({ type: 'text', text: match[6], marks: [{ type: 'link', attrs: { href: match[7] } }] })
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) })
  }
  
  return result.length > 0 ? result : [{ type: 'text', text }]
}

