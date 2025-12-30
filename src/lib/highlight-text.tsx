import { useMemo } from 'react'

interface HighlightTextProps {
  text: string
  query: string
}

/**
 * 高亮显示匹配的文本
 *
 * @example
 * <HighlightText text="Hello World" query="World" />
 * // => Hello <mark>World</mark>
 */
export function HighlightText({ text, query }: HighlightTextProps) {
  const highlighted = useMemo(() => {
    if (!query.trim()) return text

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        )
      }
      return part
    })
  }, [text, query])

  return <>{highlighted}</>
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
