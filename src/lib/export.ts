
import type { Page, JSONContent } from '@/types'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'

// Extensions used for HTML generation (must match editor extensions)
const extensions = [
  StarterKit,
  Link,
  TaskList,
  TaskItem,
  Image,
]

export function exportToJSON(page: Page) {
  const data = JSON.stringify(page, null, 2)
  downloadFile(data, `${page.title || 'untitled'}.json`, 'application/json')
}

export function exportToMarkdown(page: Page) {
  // Simple Tiptap JSON to Markdown converter (basic implementation)
  // For production, use a library like prosemirror-markdown or custom serializer
  // Here we use a very basic approach or just export the JSON content structure for now
  // as writing a full serializer is complex.
  // Alternatively, we can use the HTML and convert to Markdown using a library?
  // Let's stick to JSON export as primary backup, and maybe simple text for now.
  
  // Real implementation requires recursive traversal of JSONContent.
  // For this MVP, let's just export the text content.
  
  const content = page.content as JSONContent
  const text = content.content?.map((node: JSONContent) => {
     if (node.type === 'paragraph') return (node.content as JSONContent[] | undefined)?.map((c: JSONContent) => c.text).join('') + '\n'
     if (node.type === 'heading') return '#'.repeat(node.attrs?.level || 1) + ' ' + (node.content as JSONContent[] | undefined)?.map((c: JSONContent) => c.text).join('') + '\n'
     return ''
  }).join('\n') || ''

  downloadFile(text, `${page.title || 'untitled'}.md`, 'text/markdown')
}

export function exportToHTML(page: Page) {
  const html = generateHTML(page.content, extensions)
  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
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
