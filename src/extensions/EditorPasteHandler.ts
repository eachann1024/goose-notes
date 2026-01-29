import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser } from "@tiptap/pm/model";
import MarkdownIt from "markdown-it";
import { parseMarkdownTableToHtml } from "@/lib/markdownTableParser";

const md = new MarkdownIt({ html: true }).enable("table");

function convertChineseLists(text: string): string {
  if (!text.includes("\n")) {
    return text;
  }

  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";

    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        result.push(line);
      } else {
        inCodeBlock = false;
        result.push(line);
      }
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    const bulletMatch = line.match(/^无序列表[：:]\s*(.+)$/);
    if (bulletMatch) {
      result.push(`- ${bulletMatch[1]}`);
      continue;
    }

    const orderedMatch = line.match(/^有序列表[：:]\s*(.+)$/);
    if (orderedMatch) {
      result.push(`1. ${orderedMatch[1]}`);
      continue;
    }

    const taskMatch = line.match(/^待办[：:]\s*(.+)$/);
    if (taskMatch) {
      result.push(`- [ ] ${taskMatch[1]}`);
      continue;
    }

    if (i > 0) {
      const prevLine = lines[i - 1] || "";
      if (
        prevLine.includes("引用与代码") &&
        line.trim() &&
        !line.startsWith(">")
      ) {
        result.push(`> ${line}`);
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

function convertCodeLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      result.push(line);
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    const codeMatch = line.match(
      /^\s*(print|log|console\.|function|const|let|var|import|export|class|if|for|while|def|return)\s*[\(\{]/,
    );
    if (codeMatch && line.trim()) {
      const prevLine = i > 0 ? lines[i - 1] : "";
      if (prevLine.trim() === "" || prevLine.trim().startsWith("```")) {
        result.push("```");
        result.push(line.trim());
        continue;
      }
    }

    result.push(line);
  }

  if (inCodeBlock) {
    result.push("```");
  }

  return result.join("\n");
}

// 预处理粘贴的文本：还原被转义的格式
function preprocessPastedText(text: string): string {
  // 还原被转义的 task list: \[ \] -> [ ], \[x\] -> [x]
  text = text.replace(/^(\s*-?\s*)\\\[\s*([x ]?)\s*\\\]/gim, "$1[$2]");

  return text;
}

// 保留额外空行：markdown 会吃掉块之间的空行，用占位符保留
const EMPTY_LINE_PLACEHOLDER = '<!--EMPTY_PARA-->';

function preserveEmptyLines(text: string): string {
  // 先把只含空白字符的行转为真正的空行
  let normalized = text.replace(/\n[ \t]+\n/g, '\n\n');
  
  // 核心修复：如果是列表项之间的空行，不要插入占位符，否则会打断列表
  // 匹配：行首是列表符，后面跟着空行，再后面又是列表符
  // 注意：这只是一个简化的 heuristic，但应该能覆盖大多数 copy-paste 场景
  // 列表符：- * + 1. 等
  // 我们先保护列表间的空行
  const LIST_ITEM_REGEX = /^(\s*([-*+]|\d+\.)\s+)/;
  
  const lines = normalized.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    processedLines.push(line);
    
    // 如果是最后一行，不需要处理后面的空行
    if (i === lines.length - 1) break;
    
    // 检查下一行是否是空行
    if (lines[i+1].trim() === '') {
       // 这是一个空行，或者连续空行的开始
       // 检查上下文：如果当前行是列表项，且下下行（跳过空行后）也是列表项，则跳过插入占位符
       
       // 找到下一个非空行
       let nextNonEmptyIndex = i + 1;
       while (nextNonEmptyIndex < lines.length && lines[nextNonEmptyIndex].trim() === '') {
         nextNonEmptyIndex++;
       }
       
       if (nextNonEmptyIndex < lines.length) {
         const currentIsList = LIST_ITEM_REGEX.test(line);
         const nextIsList = LIST_ITEM_REGEX.test(lines[nextNonEmptyIndex]);
         
         if (currentIsList && nextIsList) {
           // 都在列表里，不做任何事，让 markdown handle loose list
           continue; 
         }
       }
    }
  }

  // 上面的循环很难完美重构 preserveEmptyLines 的逻辑，我们换个简单策略：
  // 直接用正则替换，但排除列表上下文
  
  return normalized.replace(/\n(\n+)/g, (match, extraNewlines, offset, fullText) => {
    // 检查前面的一行
    const preText = fullText.substring(0, offset);
    const lastLineBreak = preText.lastIndexOf('\n');
    const prevLine = preText.substring(lastLineBreak + 1);
    
    // 检查后面的一行
    const postText = fullText.substring(offset + match.length);
    const nextLineBreak = postText.indexOf('\n');
    const nextLine = nextLineBreak === -1 ? postText : postText.substring(0, nextLineBreak);
    
    const isPrevList = /^(\s*([-*+]|\d+\.)\s+)/.test(prevLine);
    const isNextList = /^(\s*([-*+]|\d+\.)\s+)/.test(nextLine);
    
    if (isPrevList || isNextList) {
       // 如果处于列表上下文中，不要插入破坏性的占位符
       // 只保留换行符本身，让 markdown 决定是 tight 还是 loose list
       return match;
    }

    const emptyCount = extraNewlines.length;
    return '\n' + (EMPTY_LINE_PLACEHOLDER + '\n').repeat(emptyCount);
  });
}

function restoreEmptyLines(html: string): string {
  // markdown-it 直接输出 HTML 注释，不包在 <p> 里，直接替换为空段落
  return html.replace(new RegExp(`${EMPTY_LINE_PLACEHOLDER}\\n?`, 'g'), '<p></p>');
}

function applyPasteTransaction(view: any, tr: any) {
  tr.setMeta("uiEvent", "paste");
  tr.setMeta("addToHistory", true);
  view.dispatch(tr);
}

function isInsideNodeTypes($pos: any, names: string[]): boolean {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    if (names.includes($pos.node(depth).type.name)) {
      return true;
    }
  }
  return false;
}

function shouldForceInlinePaste($pos: any): boolean {
  if ($pos.parent.type.name === "heading") {
    return true;
  }
  return isInsideNodeTypes($pos, ["listItem", "taskItem"]);
}

function hasInlineCode(text: string): boolean {
  return /`[^`]+`/.test(text);
}

function extractInlineCode(text: string): { content: string; ranges: number[][] } | null {
  let content = "";
  const ranges: number[][] = [];
  let inCode = false;
  let codeStart = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : "";

    if (char === "`" && prevChar !== "\\") {
      if (inCode) {
        ranges.push([codeStart, content.length]);
      } else {
        codeStart = content.length;
      }
      inCode = !inCode;
      continue;
    }

    content += char;
  }

  if (inCode) {
    return null;
  }

  return { content, ranges };
}

// 检测文本是否包含 markdown 结构
function hasMarkdownStructure(text: string): boolean {
  const patterns = [
    /^#{1,6}\s/m, // 标题
    /^[-*+]\s/m, // 无序列表
    /^\d+\.\s/m, // 有序列表
    /^>\s/m, // 引用
    /^```/m, // 代码块
    /^\|.*\|.*\|/m, // 表格（至少两个 |）
    /^- \[[ x]\]/im, // 任务列表
    /^\[[ x]\]/im, // 孤立的任务项（无 - 前缀）
  ];
  return patterns.some((p) => p.test(text));
}

export const EditorPasteHandler = Extension.create({
  name: "editorPasteHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("editorPasteHandler"),
        props: {
          handlePaste: (view, event) => {
            const { state } = view;
            const { selection } = state;
            const { $from } = selection;

            // If inside a code block, let the default handler handle it (plain text paste)
            if (selection.$from.parent.type.name === "codeBlock") {
              return false;
            }

            const textPlain = event.clipboardData?.getData("text/plain");
            if (!textPlain) return false;

            // 预处理粘贴的文本：还原被转义的格式，移除多余空行
            const processedTextPlain = preprocessPastedText(textPlain);

            // 判断是否在"块内"粘贴
            // 方法1：检查父节点是否是 textblock（标准文本块如 paragraph、heading）
            const isTextblock = $from.parent.type.isTextblock;
            // 方法2：检查父节点是否包含 inline 内容（如 Callout 等自定义节点）
            const containsInline =
              $from.parent.type.spec.content?.includes("inline");
            const isTextBlock = isTextblock || containsInline;
            const hasContent = $from.parent.textContent.length > 0;
            const notAtStart = $from.parentOffset > 0;
            // 列表项内始终视为行内上下文（修复粘贴空行问题）
            const isInListItem = isInsideNodeTypes($from, ["listItem", "taskItem"]);
            const isInlineContext = isTextBlock && (hasContent || notAtStart || isInListItem);

            if (isInlineContext && hasInlineCode(processedTextPlain)) {
              const extracted = extractInlineCode(processedTextPlain);
              const codeMark = state.schema.marks.code;
              if (extracted && codeMark && !processedTextPlain.includes("\n")) {
                const insertPos = selection.from;
                const tr = state.tr.insertText(extracted.content);
                extracted.ranges.forEach(([start, end]) => {
                  if (start === end) return;
                  tr.addMark(insertPos + start, insertPos + end, codeMark.create());
                });
                applyPasteTransaction(view, tr);
                return true;
              }
            }

            if (isInlineContext && shouldForceInlinePaste($from)) {
              let cleanText = processedTextPlain;
              // 修复：只在单行且有列表前缀时才移除
              if (!cleanText.includes('\n')) {
                cleanText = cleanText
                  .replace(/^[-*+]\s+/, '')           // 无序列表
                  .replace(/^\d+\.\s+/, '')           // 有序列表
                  .replace(/^- \[[ x]\]\s*/i, '');   // 任务列表
              }
              // 多行时保留前缀，避免误伤
              cleanText = cleanText.replace(/\r?\n+/g, " ").trim();
              const tr = state.tr.insertText(cleanText);
              applyPasteTransaction(view, tr);
              return true;
            }

            // 块内粘贴简单文本：去掉换行直接插入
            if (isInlineContext && !hasMarkdownStructure(processedTextPlain)) {
              const cleanText = processedTextPlain.replace(/\r?\n/g, "");
              const tr = state.tr.insertText(cleanText);
              applyPasteTransaction(view, tr);
              return true;
            }

            const tableHtml = parseMarkdownTableToHtml(processedTextPlain);
            if (tableHtml) {
              const { state } = view;
              const parser = DOMParser.fromSchema(state.schema);
              const doc = new window.DOMParser().parseFromString(
                tableHtml,
                "text/html",
              );
              const slice = parser.parseSlice(doc.body);
              const tr = state.tr.replaceSelection(slice);
              applyPasteTransaction(view, tr);
              return true;
            }

            // 尝试处理外部 HTML 格式粘贴（如 Word、浏览器复制）
            const htmlData = event.clipboardData?.getData("text/html");
            if (htmlData && !hasMarkdownStructure(processedTextPlain)) {
              try {
                const parser = DOMParser.fromSchema(state.schema);
                const tempDiv = new window.DOMParser().parseFromString(
                  htmlData,
                  "text/html",
                );

                // 解析为 ProseMirror Slice
                const slice = parser.parseSlice(tempDiv.body);

                if (slice.content.size > 0) {
                  const tr = state.tr.replaceSelection(slice);
                  applyPasteTransaction(view, tr);
                  return true;
                }
              } catch (e) {
                console.warn('[EditorPasteHandler] HTML parse failed, fallback to markdown', e);
                // 降级到 Markdown 处理
              }
            }

            let processedText = convertChineseLists(processedTextPlain);
            processedText = convertCodeLines(processedText);
            // 保留空行信息（markdown 会吃掉）
            processedText = preserveEmptyLines(processedText);
            
            let html = md.render(processedText);
            
            if (html) {
              // 还原空行为空 paragraph
              html = restoreEmptyLines(html);
              
              // 清理块级标签之间的空白（但保留空 paragraph）
              html = html.replace(/(<\/(h[1-6]|div|ul|ol|li|blockquote|table|tr|td|th)>)\s+(<)/gi, '$1$3');
              // 清理非空 paragraph 之间的空白
              html = html.replace(/(<\/p>)\s+(<p>(?!<\/p>))/gi, '$1$2');

              // 强力修复：手动将 text 中的 markdown task list 转换为 Tiptap 可识别的 HTML
              // 使用 DOMParser 而不是正则，以确保处理嵌套列表和复杂 HTML 的稳定性
              if (html.includes('<li>')) {
                 try {
                   const parser = new window.DOMParser();
                   const tempDoc = parser.parseFromString(html, "text/html");
                   const lis = tempDoc.querySelectorAll('li');
                   
                   let hasTaskItem = false;
                   lis.forEach(li => {
                     let found: { match: RegExpMatchArray; node: Node; text: string } | null = null;

                     // 辅助函数：检查节点是否包含 task marker
                     const findTaskMarker = (node: Node) => {
                       if (node.nodeType === Node.TEXT_NODE) {
                         const text = node.textContent || '';
                         // 忽略纯空白文本节点
                         if (!text.trim()) return null;
                         
                         const m = text.match(/^\s*\[([ x])\]\s*/i);
                         if (m) {
                           return { match: m, node: node, text: text };
                         }
                       }
                       return null;
                     };

                     // 1. 遍历 li 的直接子节点
                     for (let i = 0; i < li.childNodes.length; i++) {
                       found = findTaskMarker(li.childNodes[i]);
                       if (found) break;
                     }

                     // 2. 如果没找到，且包含 P 标签，检查 P 的子节点
                     // 这是为了处理 markdown-it 在 loose list 中生成的 <li>\n<p>... 结构
                     if (!found) {
                       const p = Array.from(li.children).find(c => c.tagName === 'P');
                       if (p) {
                         for (let i = 0; i < p.childNodes.length; i++) {
                           found = findTaskMarker(p.childNodes[i]);
                           if (found) break;
                         }
                       }
                     }
                     
                     if (found) {
                        const { match, node, text } = found;
                        const isChecked = match[1].toLowerCase() === 'x';
                        li.setAttribute('data-type', 'taskItem');
                        li.setAttribute('data-checked', String(isChecked));
                        
                        // 移除 [ ] 标记
                        node.textContent = text.substring(match[0].length);
                        hasTaskItem = true;
                     }
                   });

                   if (hasTaskItem) {
                      // 给所有包含 taskItem 的 ul 添加 data-type="taskList"
                      const taskUls = new Set<Element>();
                      tempDoc.querySelectorAll('li[data-type="taskItem"]').forEach(li => {
                        if (li.parentElement && li.parentElement.tagName === 'UL') {
                          taskUls.add(li.parentElement);
                        }
                      });
                      taskUls.forEach(ul => ul.setAttribute('data-type', 'taskList'));
                      
                      html = tempDoc.body.innerHTML;
                   }
                 } catch (e) {
                   console.warn('[EditorPasteHandler] Task list DOM parsing failed, falling back to regex/original', e);
                   // Fallback logic could go here, or just keep original html
                 }
              }

              const { state } = view;
              const parser = DOMParser.fromSchema(state.schema);
              const doc = new window.DOMParser().parseFromString(
                html,
                "text/html",
              );
              const slice = parser.parseSlice(doc.body);
              const tr = state.tr.replaceSelection(slice);
              applyPasteTransaction(view, tr);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
