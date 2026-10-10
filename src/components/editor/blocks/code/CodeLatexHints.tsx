import { useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function CodeLatexHints({
  collapsed,
  language,
  isEditable,
}: {
  collapsed: boolean;
  language: string;
  isEditable: boolean;
}) {
  const [showLatexHint, setShowLatexHint] = useState(false);
  return (
    <>
      {/* LaTeX hint panel */}
      {!collapsed && language === "math" && isEditable && (
        <div className="absolute bottom-2 right-2 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLatexHint(!showLatexHint)}
            className={cn(
              "h-6 w-6 p-0 rounded-md",
              "border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)]",
              showLatexHint &&
                "border-[var(--goose-callout-accent)] bg-[var(--goose-interactive-selected)] text-link",
            )}
          >
            <GooseIcons.HelpCircle className="h-3.5 w-3.5" />
          </Button>
          {showLatexHint && (
            <div className="absolute bottom-8 right-0 z-30 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 shadow-lg">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-xs font-semibold">LaTeX 语法参考</span>
                <button
                  type="button"
                  onClick={() => setShowLatexHint(false)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                >
                  <GooseIcons.X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5">
                  {LATEX_SNIPPETS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setShowLatexHint(false)}
                      className="flex flex-col items-start gap-1 rounded-md border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] px-2 py-1.5 text-left hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {s.label}
                      </span>
                      <code className="text-[11px] font-mono text-foreground break-all">
                        {s.code}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
