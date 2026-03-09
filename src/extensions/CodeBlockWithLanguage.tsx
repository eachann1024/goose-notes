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
import { useSettings } from "@/stores/useSettings";
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

function getDefaultCodeBlockAttrs(attrs?: Record<string, unknown>) {
  return {
    wrap: useSettings.getState().defaultCodeBlockWrap,
    ...attrs,
  };
}

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
  const collapsed = node.attrs.collapsed === true || node.attrs.collapsed === "true";
  const summary =
    typeof node.attrs.summary === "string" ? node.attrs.summary : "";
  const wrapStyle: React.CSSProperties = {
    // `break-spaces` keeps whitespace-only lines editable when soft wrap is enabled.
    whiteSpace: wrap ? "break-spaces" : "pre",
    wordBreak: wrap ? "break-word" : "normal",
    overflowWrap: wrap ? "anywhere" : "normal",
  };
  const [showLatexHint, setShowLatexHint] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const summaryInputRef = useRef<HTMLInputElement>(null);

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
    useSettings.getState().setDefaultCodeBlockWrap(newWrap);
    updateAttributes({ wrap: newWrap });
  };

  const normalizeSummary = (value: string) =>
    value.replace(/[\r\n]+/g, " ").trim();

  const handleSummaryCommit = () => {
    const nextSummary = normalizeSummary(summaryDraft);
    if (nextSummary !== summary) {
      updateAttributes({ summary: nextSummary });
    }
    setSummaryDraft(nextSummary);
    setIsEditingSummary(false);
  };

  const handleSummaryCancel = () => {
    setSummaryDraft(summary);
    setIsEditingSummary(false);
  };

  const handleCollapsedChange = () => {
    updateAttributes({ collapsed: !collapsed });
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
  const supportsLineNumbers = !(language === "math" || language === "mermaid");
  const showLineNumbers = supportsLineNumbers && !wrap;
  const isSummaryReadonly = !editor.isEditable || !isEditingSummary;
  const summaryValue = isEditingSummary ? summaryDraft : summary;

  useEffect(() => {
    if (!isEditingSummary) return;
    const timer = window.setTimeout(() => {
      summaryInputRef.current?.focus();
      summaryInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isEditingSummary]);

  return (
    <NodeViewWrapper
      className={cn(
        "code-block-node relative my-4",
        showLineNumbers && "code-block-with-lines",
        isActive && "is-active",
        collapsed && "is-collapsed",
      )}
    >
      <div className="code-block-toolbar-row" contentEditable={false}>
        <div
          className="code-block-toolbar-left"
          contentEditable={false}
          suppressContentEditableWarning
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={collapsed ? "展开代码块" : "折叠代码块"}
            aria-pressed={collapsed}
            onClick={handleCollapsedChange}
            className={cn(
              "code-block-collapse-toggle h-7 min-w-7 p-0",
              collapsed && "is-collapsed",
            )}
          >
            <LucideIcons.ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Input
            ref={summaryInputRef}
            value={summaryValue}
            readOnly={isSummaryReadonly}
            placeholder="添加代码说明"
            onMouseDown={(e: React.MouseEvent<HTMLInputElement>) => {
              e.stopPropagation();
              if (!editor.isEditable) return;
              if (!isEditingSummary) {
                setSummaryDraft(summary);
              }
            }}
            onFocus={() => {
              if (!editor.isEditable) return;
              if (!isEditingSummary) {
                setSummaryDraft(summary);
                setIsEditingSummary(true);
              }
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (!isEditingSummary) return;
              setSummaryDraft(e.target.value);
            }}
            onBlur={() => {
              if (!isEditingSummary) return;
              handleSummaryCommit();
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (isEditingSummary) {
                  handleSummaryCommit();
                }
                summaryInputRef.current?.blur();
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                handleSummaryCancel();
                summaryInputRef.current?.blur();
                return;
              }
              e.stopPropagation();
            }}
            className={cn(
              "code-block-summary-input h-7 !h-7 !rounded-md !px-1.5 !py-0 !text-xs !shadow-none focus-visible:!ring-0 focus-visible:!ring-offset-0",
              isSummaryReadonly && "is-readonly",
              isSummaryReadonly && !summary && "is-placeholder",
            )}
            title={summary || "添加代码说明"}
          />
        </div>
        <CodeBlockToolbar
          language={language}
          onLanguageChange={handleLanguageChange}
          getCodeContent={getCodeContent}
          onFormat={handleFormat}
          wrap={wrap}
          onWrapChange={handleWrapChange}
          editable={editor.isEditable}
        />
      </div>

      {!collapsed && (
        <div className="code-block-content">
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
              className="preview-container select-none cursor-pointer bg-transparent dark:bg-[#202020]"
              onClick={() => {
                if (typeof getPos === "function") {
                  editor.commands.focus(getPos() + 1);
                }
              }}
            >
              <div className="bg-transparent dark:bg-[#2E2E2D]">
                {language === "math" && (
                  <MathView value={textContent} displayMode={true} />
                )}
                {language === "mermaid" && <MermaidView value={textContent} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LaTeX 语法提示面板 */}
      {!collapsed && language === "math" && editor.isEditable && isActive && (
        <div className="absolute bottom-2 right-2 z-20">
          <TooltipProvider>
            <Tooltip open={showLatexHint} onOpenChange={setShowLatexHint}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLatexHint(!showLatexHint)}
                  className={cn(
                    "h-6 w-6 p-0 rounded-md",
                    "bg-gradient-to-r from-background/98 to-background/94 hover:from-background/99 hover:to-background/95",
                    "border border-border/50",
                    "backdrop-blur-[1px] transition-all duration-200",
                    showLatexHint && "bg-primary/10 border-primary/30 text-primary",
                  )}
                >
                  <LucideIcons.HelpCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="w-[44rem] max-w-[calc(100vw-2rem)] whitespace-normal p-0 text-sm font-normal leading-normal"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <span className="text-sm font-semibold tracking-tight">LaTeX 语法参考</span>
                    <button
                      type="button"
                      onClick={() => setShowLatexHint(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted/70 hover:text-foreground"
                    >
                      <LucideIcons.X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[20rem] overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {LATEX_SNIPPETS.map((snippet, idx) => (
                        <button
                          key={idx}
                          type="button"
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
                          className="group flex min-h-[72px] w-full flex-col items-start gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                            {snippet.label}
                          </span>
                          <code className="w-full rounded-md bg-background px-2 py-1 font-mono text-[11px] leading-5 text-foreground whitespace-pre-wrap break-all">
                            {snippet.code}
                          </code>
                        </button>
                      ))}
                    </div>
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
      collapsed: {
        default: false,
      },
      summary: {
        default: "",
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
            .setNode("codeBlock", getDefaultCodeBlockAttrs({ language }))
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
            attrs: getDefaultCodeBlockAttrs({ language: "math" }),
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
          .setNode("codeBlock", getDefaultCodeBlockAttrs({ language }))
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
