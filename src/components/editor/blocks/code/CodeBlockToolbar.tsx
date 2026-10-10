import { useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFormatCode } from "@/components/editor/hooks/useFormatCode";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  FORMAT_SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
} from "./codeBlockLanguages";
import { CodeLanguagePicker } from "./CodeLanguagePicker";
import { CodePreviewToolbar } from "./CodePreviewToolbar";
import type { CodeBlockToolbarProps } from "./codeToolbarTypes";

export function CodeBlockToolbar({
  language,
  onLanguageChange,
  getCodeContent,
  onFormat,
  onWrapChange,
  wrap = false,
  editable = true,
  previewMode = "code",
  onPreviewModeChange,
  onOpenPreview,
  onSystemPreview,
  onDownloadPreview,
  onCopyPreview,
  canPreview = false,
}: CodeBlockToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);
  const { format, isLoading } = useFormatCode();
  const platform = useEditorPlatform();

  const displayLanguage = language
    ? LANGUAGE_DISPLAY_NAMES[language.toLowerCase()] || language
    : "Plain Text";

  const handleCopyCode = async () => {
    const content = getCodeContent();
    await platform.clipboard.copyText(content);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    if (onCopyPreview) {
      if (copyingImage) return;
      setCopyingImage(true);
      try {
        await onCopyPreview();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // 失败 toast 由 onCopyPreview 负责
      } finally {
        setCopyingImage(false);
      }
      return;
    }
    await handleCopyCode();
  };

  const handleFormatClick = async () => {
    if (!onFormat) return;
    const content = getCodeContent();
    if (!content) return;
    const formatted = await format(content, language || "text");
    if (formatted) onFormat(formatted);
  };

  const canFormat = FORMAT_SUPPORTED_LANGUAGES.includes(
    (language || "").toLowerCase(),
  );
  const isMathOrMermaid = language === "math" || language === "mermaid";
  const hasVisualPreview = isMathOrMermaid && Boolean(onPreviewModeChange);
  const chipClass = cn(
    "transition-colors duration-150",
    "border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
    "",
    "cursor-pointer rounded-md",
  );
  const chipActiveClass =
    "border-[var(--goose-block-subtle-border)] bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] hover:bg-[var(--goose-interactive-hover)]";
  const iconSize = "h-3.5 w-3.5";

  return (
    <TooltipProvider delayDuration={600}>
      <div
        contentEditable={false}
        className={cn(
          "goose-editor-position-safe-trigger goose-code-toolbar-actions inline-flex items-center",
          hasVisualPreview && "goose-code-toolbar-actions-visual",
        )}
      >
        <div className="flex shrink-0 items-center gap-1">
          <CodeLanguagePicker
            language={language}
            onLanguageChange={onLanguageChange}
            editable={editable}
            isMathOrMermaid={isMathOrMermaid}
            hasVisualPreview={hasVisualPreview}
            displayLanguage={displayLanguage}
            chipClass={chipClass}
            chipActiveClass={chipActiveClass}
          />

          {hasVisualPreview && (
            <CodePreviewToolbar
              language={language}
              onLanguageChange={onLanguageChange}
              getCodeContent={getCodeContent}
              canPreview={canPreview}
              onOpenPreview={onOpenPreview}
              onSystemPreview={onSystemPreview}
              onDownloadPreview={onDownloadPreview}
              onCopyPreview={onCopyPreview}
              previewMode={previewMode}
              onPreviewModeChange={onPreviewModeChange}
              chipClass={chipClass}
              copied={copied}
              copyingImage={copyingImage}
              handleCopy={handleCopy}
            />
          )}

          {editable && onWrapChange && !isMathOrMermaid && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={wrap ? "取消换行" : "自动换行"}
                  onClick={() => onWrapChange(!wrap)}
                  className={cn(
                    "h-6 w-6 p-0",
                    chipClass,
                    wrap && chipActiveClass,
                  )}
                >
                  {wrap ? (
                    <GooseIcons.AlignJustify className={iconSize} />
                  ) : (
                    <GooseIcons.WrapText className={iconSize} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{wrap ? "取消换行" : "自动换行"}</TooltipContent>
            </Tooltip>
          )}

          {editable && onFormat && canFormat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFormatClick}
                  disabled={isLoading}
                  className={cn("h-6 w-6 p-0", chipClass)}
                >
                  {isLoading ? (
                    <GooseIcons.Loader2
                      className={cn(iconSize, "animate-spin")}
                    />
                  ) : (
                    <GooseIcons.Sparkles className={iconSize} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>格式化代码</TooltipContent>
            </Tooltip>
          )}

          {!hasVisualPreview && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopyCode()}
                  className={cn("h-6 w-6 p-0", chipClass)}
                >
                  {copied ? (
                    <GooseIcons.Check
                      className={cn(
                        iconSize,
                        "text-[var(--goose-color-success)]",
                      )}
                    />
                  ) : (
                    <GooseIcons.Copy className={iconSize} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "已复制" : "复制代码"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
