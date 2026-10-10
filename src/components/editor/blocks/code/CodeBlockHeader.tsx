import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CodeBlockToolbar } from "./CodeBlockToolbar";
import type { CodeBlockViewProps } from "./codeBlockViewTypes";

export function CodeBlockHeader({
  language,
  wrap,
  collapsed,
  summary,
  isEditable,
  edit,
  preview,
}: CodeBlockViewProps) {
  const {
    isEditingSummary,
    setIsEditingSummary,
    summaryDraft,
    setSummaryDraft,
    summaryInputRef,
    getCodeContent,
    handleLanguageChange,
    handleWrapChange,
    handleSummaryCommit,
    handleCollapsedChange,
    handleFormat,
  } = edit;
  const {
    isVisualBlock,
    visualTitle,
    previewMode,
    setPreviewMode,
    canPreview,
    handleInternalPreview,
    handleSystemPreview,
    handleDownloadPreview,
    handleCopyPreview,
  } = preview;
  return (
    <div className="goose-code-toolbar-row" contentEditable={false}>
      <div className="goose-code-toolbar-left flex items-center gap-0.5 min-w-0 flex-1">
        {isVisualBlock ? (
          <div className="goose-code-visual-title">{visualTitle}</div>
        ) : (
          <>
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
              <GooseIcons.ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Input
              ref={summaryInputRef}
              data-goose-inline-input=""
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
                "h-6 w-full min-w-0 rounded-md border-0 bg-transparent px-1.5 text-xs shadow-none",
                "placeholder:text-placeholder",
                "",
                !isEditingSummary && !summary && "text-muted-foreground",
                !isEditingSummary && summary && "text-muted-foreground",
              )}
            />
          </>
        )}
      </div>
      <CodeBlockToolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        getCodeContent={getCodeContent}
        onFormat={__GOOSE_EDITOR_COMPACT__ ? undefined : handleFormat}
        wrap={wrap}
        onWrapChange={handleWrapChange}
        editable={isEditable}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        onOpenPreview={() => {
          if (canPreview) void handleInternalPreview();
        }}
        onSystemPreview={() => {
          if (canPreview) void handleSystemPreview();
        }}
        onDownloadPreview={handleDownloadPreview}
        onCopyPreview={handleCopyPreview}
        canPreview={canPreview}
      />
    </div>
  );
}
