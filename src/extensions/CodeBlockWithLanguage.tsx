import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Selection, Plugin, PluginKey } from "@tiptap/pm/state";
import { CodeBlockToolbar } from "@/pages/workspace/components/editor/CodeBlockToolbar";

function CodeBlockWithLanguageView({
  node,
  updateAttributes,
  editor,
  getPos,
}: any) {
  const isActive = useEditorState({
    editor,
    selector: (ctx) => {
      if (typeof getPos !== "function") {
        return ctx.editor.isActive("codeBlock");
      }
      const { from, to } = ctx.editor.state.selection;
      const pos = getPos();
      return from >= pos && to <= pos + node.nodeSize;
    },
  });
  const language = node.attrs.language || "";
  const normalizeWrap = (value: unknown) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
    }
    return undefined;
  };
  const wrapAttr = normalizeWrap(node.attrs.wrap);
  const wrap = wrapAttr ?? false;
  const wrapStyle: React.CSSProperties = {
    whiteSpace: wrap ? "pre-wrap" : "pre",
    wordBreak: wrap ? "break-word" : "normal",
    overflowWrap: wrap ? "anywhere" : "normal",
  };

  const getCodeContent = () => {
    let text = "";
    node.content?.forEach((child: any) => {
      if (child.text) text += child.text;
      child.content?.forEach((line: any) => {
        if (line.text) text += line.text;
      });
    });
    return text;
  };

  const handleLanguageChange = (newLanguage: string) => {
    updateAttributes({ language: newLanguage });
  };

  const handleWrapChange = (newWrap: boolean) => {
    updateAttributes({ wrap: newWrap });
  };

  const handleFormat = (formatted: string) => {
    if (typeof getPos === "function") {
      const pos = getPos();
      const { tr } = editor.view.state;
      const start = pos + 1;
      const end = pos + node.nodeSize - 1;

      editor.view.dispatch(
        tr.replaceWith(start, end, editor.schema.text(formatted)),
      );
    }
  };

  const textContent = node.content?.firstChild?.text || node.textContent || "";
  const lineCount = textContent.split("\n").length;
  const showLineNumbers = true;

  return (
    <NodeViewWrapper
      className={`code-block-node relative group my-4 ${showLineNumbers ? "code-block-with-lines" : ""} ${isActive ? "is-active" : ""}`}
    >
      <CodeBlockToolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        getCodeContent={getCodeContent}
        onFormat={handleFormat}
        wrap={wrap}
        onWrapChange={handleWrapChange}
        editable={editor.isEditable}
      />
      {showLineNumbers && (
        <div className="line-numbers" contentEditable={false}>
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <pre>
        <NodeViewContent className="hljs" style={wrapStyle} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockWithLanguageExtension = CodeBlockLowlight.extend({
  addAttributes() {
    const parentAttrs = this.parent?.() || {};
    const languageAttr = (parentAttrs as Record<string, unknown>).language as Record<string, unknown> | undefined;
    return {
      ...parentAttrs,
      // Keep parent's language attribute with its parseHTML intact
      language: {
        ...languageAttr,
        default: null,
      },
      wrap: {
        default: null,
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithLanguageView);
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        if (!empty) return false;
        if (!editor.isActive("codeBlock")) return false;

        const isAtStart = $from.parentOffset === 0;

        if (isAtStart) {
          const beforePos = $from.before();
          if (beforePos > 0) {
            const tr = state.tr;
            const newSelection = Selection.near(
              doc.resolve(beforePos - 1),
            );
            tr.setSelection(newSelection);
            editor.view.dispatch(tr);
            return true;
          }
        }

        return false;
      },
      ArrowDown: ({ editor }) => {
        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        if (!empty) return false;
        if (!editor.isActive("codeBlock")) return false;

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;

        if (isAtEnd) {
          const afterPos = $from.after();
          if (afterPos < doc.content.size) {
            const tr = state.tr;
            try {
              const newSelection = Selection.near(
                doc.resolve(afterPos + 1),
              );
              tr.setSelection(newSelection);
              editor.view.dispatch(tr);
              return true;
            } catch (e) {
              console.warn("Failed to move cursor out of code block", e);
              return false;
            }
          }
        }

        return false;
      },
      Tab: ({ editor }) => {
        const { state, dispatch } = editor.view;
        if (!editor.isActive("codeBlock")) return false;

        const { selection } = state;
        const { $from, $to } = selection;
        
        if ($from.parent !== $to.parent) return false;

        const tr = state.tr;
        const text = $from.parent.textContent;
        const startOffset = $from.parentOffset;
        const endOffset = $to.parentOffset;

        if (selection.empty) {
          dispatch(state.tr.insertText("  ", $from.pos));
          return true;
        }

        const lines = text.split("\n");
        let startLineIndex = -1;
        let endLineIndex = -1;
        
        let currentPos = 0;
        lines.forEach((line, index) => {
            const lineLen = line.length + 1;
            const lineStart = currentPos;
            const lineEnd = currentPos + line.length;
            
            if (startOffset < lineEnd + 1 && endOffset > lineStart) {
                if (startLineIndex === -1) startLineIndex = index;
                endLineIndex = index;
            }
            
            if (endOffset === lineStart && !selection.empty) {
                endLineIndex = index - 1;
            }
            
            currentPos += lineLen;
        });

        if (startLineIndex === -1) return false;

        let accumulatedOffset = 0;
        currentPos = 0;
        
        lines.forEach((line, index) => {
            const lineStartAbs = $from.start() + currentPos;
            
            if (index >= startLineIndex && index <= endLineIndex) {
                 tr.insertText("  ", lineStartAbs + accumulatedOffset);
                 accumulatedOffset += 2;
            }
            currentPos += line.length + 1;
        });
        
        if (dispatch) dispatch(tr);
        return true;
      },
      "Shift-Tab": ({ editor }) => {
        const { state, dispatch } = editor.view;
        if (!editor.isActive("codeBlock")) return false;

        const { selection } = state;
        const { $from, $to } = selection;
        
        if ($from.parent !== $to.parent) return false;

        const tr = state.tr;
        const text = $from.parent.textContent;
        const startOffset = $from.parentOffset;
        const endOffset = $to.parentOffset;

        const lines = text.split("\n");
        let startLineIndex = -1;
        let endLineIndex = -1;
        
        let currentPos = 0;
        lines.forEach((line, index) => {
            const lineLen = line.length + 1; 
            const lineStart = currentPos;
            const lineEnd = currentPos + line.length;
            
            if (startOffset < lineEnd + 1 && endOffset > lineStart) {
                if (startLineIndex === -1) startLineIndex = index;
                endLineIndex = index;
            }
            if (endOffset === lineStart && !selection.empty) {
                endLineIndex = index - 1;
            }
            
            currentPos += lineLen;
        });

        if (startLineIndex === -1) return false;

        let accumulatedOffset = 0;
        currentPos = 0;
        
        lines.forEach((line, index) => {
            const lineStartAbs = $from.start() + currentPos;
            
            if (index >= startLineIndex && index <= endLineIndex) {
                let deleteCount = 0;
                if (line.startsWith("  ")) deleteCount = 2;
                else if (line.startsWith(" ")) deleteCount = 1;
                
                if (deleteCount > 0) {
                    tr.delete(lineStartAbs + accumulatedOffset, lineStartAbs + accumulatedOffset + deleteCount);
                    accumulatedOffset -= deleteCount;
                }
            }
            currentPos += line.length + 1;
        });
        
        if (dispatch) dispatch(tr);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey("auto-language-detect"),
        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return;

          const { tr } = newState;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              (!node.attrs.language || node.attrs.language === "") &&
              node.textContent
            ) {
              // @ts-ignore
              const result = this.options.lowlight.highlightAuto(
                node.textContent,
              );
              const language = result.data.language;

              if (language) {
                tr.setNodeAttribute(pos, "language", language);
                modified = true;
              }
            }
          });

          if (modified) return tr;
        },
      }),
    ];
  },
});
