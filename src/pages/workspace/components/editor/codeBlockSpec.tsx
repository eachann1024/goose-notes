import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CodeBlockToolbar } from "./CodeBlockToolbar";
import { MathView } from "./MathView";
import { MermaidView } from "./MermaidView";
import { useSettings } from "@/stores/useSettings";

const LATEX_SNIPPETS = [
  { label: "分数", code: "\\frac{a}{b}" },
  { label: "上标", code: "x^{n}" },
  { label: "下标", code: "x_{n}" },
  { label: "根号", code: "\\sqrt{x}" },
  { label: "求和", code: "\\sum_{i=1}^{n}" },
  { label: "积分", code: "\\int_{a}^{b}" },
  { label: "极限", code: "\\lim_{x \\to a}" },
  { label: "无穷大", code: "\\infty" },
  { label: "不等于", code: "\\neq" },
  { label: "小于等于", code: "\\leq" },
  { label: "大于等于", code: "\\geq" },
  { label: "箭头", code: "\\rightarrow" },
  { label: "向量", code: "\\vec{a}" },
  { label: "α", code: "\\alpha" },
  { label: "β", code: "\\beta" },
  { label: "π", code: "\\pi" },
  { label: "矩阵", code: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}" },
  { label: "n次根", code: "\\sqrt[n]{x}" },
];

function CodeBlockComponent({
  block,
  contentRef,
  editor,
}: {
  block: any;
  contentRef: any;
  editor: any;
}) {
  const language = (block.props.language as string) || "text";
  const wrap = block.props.wrap === true;
  const collapsed = block.props.collapsed === true;
  const summary = typeof block.props.summary === "string" ? block.props.summary : "";
  const isEditable = editor.isEditable;

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const [showLatexHint, setShowLatexHint] = useState(false);

  const getCodeContent = useCallback(() => {
    let text = "";
    const content = block.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((c: any) => c?.text ?? "").join("");
    }
    // Walk inline content via DOM
    const el = contentRef.current;
    if (el) return el.textContent || "";
    return "";
  }, [block.content, contentRef]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      editor.updateBlock(block.id, { props: { language: lang } });
    },
    [editor, block.id],
  );

  const handleWrapChange = useCallback(
    (w: boolean) => {
      useSettings.getState().setDefaultCodeBlockWrap(w);
      editor.updateBlock(block.id, { props: { wrap: w } });
    },
    [editor, block.id],
  );

  const normalizeSummary = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

  const handleSummaryCommit = useCallback(() => {
    const next = normalizeSummary(summaryDraft);
    if (next !== summary) {
      editor.updateBlock(block.id, { props: { summary: next } });
    }
    setSummaryDraft(next);
    setIsEditingSummary(false);
  }, [summaryDraft, summary, editor, block.id]);

  const handleCollapsedChange = useCallback(() => {
    editor.updateBlock(block.id, { props: { collapsed: !collapsed } });
  }, [editor, block.id, collapsed]);

  const handleFormat = useCallback(
    (formatted: string) => {
      // BlockNote: update block content by replacing all text
      const currentContent = block.content;
      if (Array.isArray(currentContent) && currentContent.length > 0) {
        editor.updateBlock(block.id, {
          content: [{ type: "text", text: formatted, styles: {} }],
        });
      }
    },
    [editor, block.id, block.content],
  );

  const insertTextAtCursor = useCallback((text: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLPreElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        insertTextAtCursor(text.replace(/\r\n/g, "\n"));
      }
    },
    [insertTextAtCursor],
  );

  const textContent = getCodeContent();
  const lineCount = textContent.split("\n").length;
  const isMathOrMermaid = language === "math" || language === "mermaid";
  const showLineNumbers = !isMathOrMermaid && !wrap;

  useEffect(() => {
    if (!isEditingSummary) return;
    const timer = setTimeout(() => {
      summaryInputRef.current?.focus();
      summaryInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [isEditingSummary]);

  return (
    <div
      className="goose-code-block-node relative"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {/* Toolbar row */}
      <div className="goose-code-toolbar-row" contentEditable={false}>
        <div className="goose-code-toolbar-left flex items-center gap-0.5 min-w-0 flex-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={collapsed ? "展开代码块" : "折叠代码块"}
            onClick={handleCollapsedChange}
            className={cn(
              "h-6 w-6 p-0 shrink-0 rounded-md transition-transform",
              collapsed && "-rotate-90",
            )}
          >
            <LucideIcons.ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Input
            ref={summaryInputRef}
            value={isEditingSummary ? summaryDraft : summary}
            readOnly={!isEditable || !isEditingSummary}
            placeholder="添加代码说明"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!isEditable) return;
              if (!isEditingSummary) setSummaryDraft(summary);
            }}
            onFocus={() => {
              if (!isEditable) return;
              if (!isEditingSummary) {
                setSummaryDraft(summary);
                setIsEditingSummary(true);
              }
            }}
            onChange={(e) => {
              if (!isEditingSummary) return;
              setSummaryDraft(e.target.value);
            }}
            onBlur={() => {
              if (!isEditingSummary) return;
              handleSummaryCommit();
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                if (isEditingSummary) handleSummaryCommit();
                summaryInputRef.current?.blur();
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setSummaryDraft(summary);
                setIsEditingSummary(false);
                summaryInputRef.current?.blur();
                return;
              }
              e.stopPropagation();
            }}
            className={cn(
              "h-6 rounded-md border-0 bg-transparent px-1.5 text-xs shadow-none",
              "placeholder:text-muted-foreground/50",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              !isEditingSummary && !summary && "opacity-50",
              !isEditingSummary && summary && "opacity-70",
            )}
          />
        </div>
        <CodeBlockToolbar
          language={language}
          onLanguageChange={handleLanguageChange}
          getCodeContent={getCodeContent}
          onFormat={handleFormat}
          wrap={wrap}
          onWrapChange={handleWrapChange}
          editable={isEditable}
        />
      </div>

      {/* Code content */}
      {!collapsed && (
        <div className="goose-code-content-wrapper">
          {showLineNumbers && (
            <div className="goose-code-line-numbers" contentEditable={false}>
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <pre
            className={cn(
              "goose-code-pre",
              wrap && "goose-code-pre-wrap",
              isMathOrMermaid && "goose-code-pre-source",
            )}
            onPaste={handlePaste}
          >
            <code
              ref={contentRef}
              className="goose-code-content hljs"
              style={wrap ? { whiteSpace: "break-spaces", wordBreak: "break-word", overflowWrap: "anywhere" } : undefined}
            />
          </pre>
          {isMathOrMermaid && textContent && (
            <div
              contentEditable={false}
              className="goose-code-preview select-none cursor-pointer bg-transparent"
            >
              {language === "math" && <MathView value={textContent} displayMode={true} />}
              {language === "mermaid" && <MermaidView value={textContent} />}
            </div>
          )}
        </div>
      )}

      {/* LaTeX hint panel */}
      {!collapsed && language === "math" && isEditable && (
        <div className="absolute bottom-2 right-2 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLatexHint(!showLatexHint)}
            className={cn(
              "h-6 w-6 p-0 rounded-md",
              "bg-background/90 border border-border/50",
              showLatexHint && "bg-primary/10 border-primary/30 text-primary",
            )}
          >
            <LucideIcons.HelpCircle className="h-3.5 w-3.5" />
          </Button>
          {showLatexHint && (
            <div className="absolute bottom-8 right-0 z-30 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 shadow-lg">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-xs font-semibold">LaTeX 语法参考</span>
                <button
                  type="button"
                  onClick={() => setShowLatexHint(false)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                >
                  <LucideIcons.X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5">
                  {LATEX_SNIPPETS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setShowLatexHint(false)}
                      className="flex flex-col items-start gap-1 rounded-md border bg-muted/30 px-2 py-1.5 text-left hover:bg-accent/60"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                      <code className="text-[11px] font-mono text-foreground break-all">{s.code}</code>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const codeBlockSpec = createReactBlockSpec(
  {
    type: "codeBlock",
    propSchema: {
      ...defaultProps,
      language: { default: "text" },
      wrap: { default: false },
      collapsed: { default: false },
      summary: { default: "" },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef, editor }) => (
      <CodeBlockComponent block={block} contentRef={contentRef} editor={editor} />
    ),
    toExternalHTML: ({ block, contentRef }) => (
      <pre>
        <code ref={contentRef} />
      </pre>
    ),
  },
)();
