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

// 预处理粘贴的文本：还原被转义的格式，移除多余空行
function preprocessPastedText(text: string): string {
  // 还原被转义的 task list: \[ \] -> [ ], \[x\] -> [x]
  text = text.replace(/^(\s*-?\s*)\\\[\s*([x ]?)\s*\\\]/gim, "$1[$2]");

  // 移除列表/引用间的多余空行
  text = text.replace(/(\n\s*[-*>\d]\s.*)\n{2,}(\s*[-*>\d]\s)/g, "$1\n$2");

  return text;
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
              // 如果粘贴内容有列表前缀，去除它（避免粘贴时产生空行）
              cleanText = cleanText
                .replace(/^[-*+]\s+/gm, '')           // 无序列表
                .replace(/^\d+\.\s+/gm, '')           // 有序列表
                .replace(/^- \[[ x]\]\s*/gim, '');    // 任务列表
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

            let processedText = convertChineseLists(processedTextPlain);
            processedText = convertCodeLines(processedText);

            const html = md.render(processedText);
            if (html) {
              const { state } = view;
              const parser = DOMParser.fromSchema(state.schema);
              const doc = new window.DOMParser().parseFromString(
                html,
                "text/html",
              );
              const slice = parser.parseSlice(doc.body, {
                preserveWhitespace: true,
              });
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
