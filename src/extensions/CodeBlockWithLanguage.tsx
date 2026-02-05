import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Selection, Plugin, PluginKey } from "@tiptap/pm/state";
import { CodeBlockToolbar } from "@/pages/workspace/components/editor/CodeBlockToolbar";
import { MathView } from "@/pages/workspace/components/editor/extensions/MathView";
import { MermaidView } from "@/pages/workspace/components/editor/extensions/MermaidView";
import { InputRule } from "@tiptap/core";

// LaTeX 常用语法提示
const LATEX_SNIPPETS = [
  { label: "分数", code: "\\frac{a}{b}", example: "\\frac{1}{2}" },
  { label: "上标", code: "x^{n}", example: "x^{2}" },
  { label: "下标", code: "x_{n}", example: "x_{i}" },
  { label: "根号", code: "\\sqrt{x}", example: "\\sqrt{2}" },
  { label: "n次根", code: "\\sqrt[n]{x}", example: "\\sqrt[3]{8}" },
  { label: "求和", code: "\\sum_{i=1}^{n}", example: "\\sum_{i=1}^{n} i" },
  { label: "积分", code: "\\int_{a}^{b}", example: "\\int_{0}^{1} x dx" },
  { label: "极限", code: "\\lim_{x \\to a}", example: "\\lim_{x \\to 0}" },
  { label: "希腊字母 α", code: "\\alpha", example: "\\alpha" },
  { label: "希腊字母 β", code: "\\beta", example: "\\beta" },
  { label: "希腊字母 π", code: "\\pi", example: "\\pi" },
  { label: "无穷大", code: "\\infty", example: "\\infty" },
  { label: "不等于", code: "\\neq", example: "\\neq" },
  { label: "小于等于", code: "\\leq", example: "\\leq" },
  { label: "大于等于", code: "\\geq", example: "\\geq" },
  { label: "箭头", code: "\\rightarrow", example: "\\rightarrow" },
  { label: "向量", code: "\\vec{a}", example: "\\vec{v}" },
  { label: "矩阵", code: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}", example: "matrix" },
];

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
  const [showLatexHint, setShowLatexHint] = useState(false);

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
  const showLineNumbers = !(language === "math" || language === "mermaid");

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
      <pre
        className={cn(
          (language === "math" || language === "mermaid") &&
            !isActive &&
            "hidden",
        )}
      >
        <NodeViewContent className="hljs" style={wrapStyle} />
      </pre>

      {(language === "math" || language === "mermaid") && (
        <div
          contentEditable={false}
          className="preview-container select-none cursor-pointer"
          onClick={() => {
             if (typeof getPos === "function") {
               editor.commands.focus(getPos() + 1);
             }
          }}
        >
          {language === "math" && (
            <MathView value={textContent} displayMode={true} />
          )}
          {language === "mermaid" && <MermaidView value={textContent} />}
        </div>
      )}

      {/* LaTeX 语法提示面板 */}
      {language === "math" && editor.isEditable && (
        <div className="absolute bottom-2 right-2 z-10">
          <TooltipProvider>
            <Tooltip open={showLatexHint} onOpenChange={setShowLatexHint}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLatexHint(!showLatexHint)}
                  className={cn(
                    "h-6 w-6 p-0 rounded-md",
                    "bg-gradient-to-r from-background/90 to-background/80 hover:from-background/95 hover:to-background/85",
                    "border border-border/50",
                    "backdrop-blur-sm transition-all duration-200",
                    showLatexHint && "bg-primary/10 border-primary/30 text-primary",
                  )}
                >
                  <LucideIcons.HelpCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="w-72 p-0 bg-popover border shadow-lg"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">LaTeX 语法参考</span>
                    <button
                      onClick={() => setShowLatexHint(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <LucideIcons.X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                    {LATEX_SNIPPETS.map((snippet, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const pos = getPos();
                          if (typeof pos === "number") {
                            const { tr } = editor.view.state;
                            const insertPos = pos + node.nodeSize - 1;
                            editor.view.dispatch(
                              tr.insertText(snippet.code, insertPos)
                            );
                            editor.commands.focus(insertPos + snippet.code.length);
                          }
                          setShowLatexHint(false);
                        }}
                        className="flex items-center justify-between px-2 py-1.5 text-left text-xs rounded hover:bg-accent group"
                      >
                        <span className="text-muted-foreground group-hover:text-foreground">
                          {snippet.label}
                        </span>
                        <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">
                          {snippet.code.length > 12
                            ? snippet.code.slice(0, 12) + "..."
                            : snippet.code}
                        </code>
                      </button>
                    ))}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const CodeBlockWithLanguageExtension = CodeBlockLowlight.extend({
  addAttributes() {
    const parentAttrs = this.parent?.() || {};
    const languageAttr = (parentAttrs as Record<string, unknown>).language as
      | Record<string, unknown>
      | undefined;
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

  addInputRules() {
    return [
      new InputRule({
        find: /^```([a-zA-Z0-9_-]+)?\s$/,
        handler: ({ state, range, match, chain }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parentOffset > range.to - range.from) return null;

          const language = match?.[1] ? match[1].trim() : null;
          chain()
            .deleteRange(range)
            .setNode("codeBlock", { language })
            .run();
          return null;
        },
      }),
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range, commands }) => {
          const $from = state.doc.resolve(range.from);
          const textBefore = $from.parent.textBetween(
            0,
            $from.parentOffset,
            null,
            "\ufffc"
          );
          // 确保在段落开头
          const isValidStart =
            textBefore === "" ||
            textBefore === " " ||
            textBefore.endsWith("\n");
          if (!isValidStart) return null;

          commands.insertContentAt(range, {
            type: "codeBlock",
            attrs: { language: "math" },
          });
          return null;
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithLanguageView);
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) return false;
        if (editor.isActive("codeBlock")) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.parentOffset !== $from.parent.content.size) return false;

        const text = $from.parent.textBetween(
          0,
          $from.parent.content.size,
          undefined,
          "\ufffc",
        );
        const trimmed = text.trim();
        const match = trimmed.match(/^```([a-zA-Z0-9_-]+)?$/);
        if (!match) return false;

        const language = match?.[1] ? match[1].trim() : null;
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.start(), to: $from.end() })
          .setNode("codeBlock", { language })
          .run();
        return true;
      },
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
            const newSelection = Selection.near(doc.resolve(beforePos - 1));
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
              const newSelection = Selection.near(doc.resolve(afterPos + 1));
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
              tr.delete(
                lineStartAbs + accumulatedOffset,
                lineStartAbs + accumulatedOffset + deleteCount,
              );
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
