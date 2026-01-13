import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser } from "@tiptap/pm/model";
import MarkdownIt from "markdown-it";
import { parseMarkdownTableToHtml } from "@/lib/markdownTableParser";

const md = new MarkdownIt({ html: true }).enable("table");

function convertChineseLists(text: string): string {
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
            
            // If inside a code block, let the default handler handle it (plain text paste)
            if (selection.$from.parent.type.name === "codeBlock") {
              return false;
            }

            const textPlain = event.clipboardData?.getData("text/plain");
            if (!textPlain) return false;

            const tableHtml = parseMarkdownTableToHtml(textPlain);
            if (tableHtml) {
              const { state, dispatch } = view;
              const parser = DOMParser.fromSchema(state.schema);
              const doc = new window.DOMParser().parseFromString(
                tableHtml,
                "text/html",
              );
              const slice = parser.parseSlice(doc.body);
              const tr = state.tr.replaceSelection(slice);
              dispatch(tr);
              return true;
            }

            let processedText = convertChineseLists(textPlain);
            processedText = convertCodeLines(processedText);

            const html = md.render(processedText);
            if (html) {
              const { state, dispatch } = view;
              const parser = DOMParser.fromSchema(state.schema);
              const doc = new window.DOMParser().parseFromString(
                html,
                "text/html",
              );
              const slice = parser.parseSlice(doc.body, {
                preserveWhitespace: true,
              });
              const tr = state.tr.replaceSelection(slice);
              dispatch(tr);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
