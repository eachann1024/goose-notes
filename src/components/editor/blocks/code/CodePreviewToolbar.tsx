import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PREVIEW_ACTION_TOOLTIP,
  previewPointerHandlers,
} from "@/lib/preview/previewAction";
import type { CodeBlockToolbarProps, CodeCopyState } from "./codeToolbarTypes";

export function CodePreviewToolbar({
  canPreview,
  onOpenPreview,
  onSystemPreview,
  onDownloadPreview,
  onCopyPreview,
  previewMode,
  onPreviewModeChange,
  chipClass,
  copied,
  copyingImage,
  handleCopy,
}: CodeBlockToolbarProps & CodeCopyState & { chipClass: string }) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canPreview}
            className={cn("h-7 w-7 p-0", chipClass)}
            {...previewPointerHandlers({
              disabled: !canPreview,
              onInternal: () => onOpenPreview?.(),
              onSystem: () => onSystemPreview?.(),
            })}
          >
            <GooseIcons.Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{PREVIEW_ACTION_TOOLTIP}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="下载图片"
            onClick={onDownloadPreview}
            disabled={!canPreview}
            className={cn("h-7 w-7 p-0", chipClass)}
          >
            <GooseIcons.Download className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>下载图片</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleCopy()}
            disabled={copyingImage || (Boolean(onCopyPreview) && !canPreview)}
            className={cn("h-7 w-7 p-0", chipClass)}
            aria-label={
              copied ? "已复制" : onCopyPreview ? "复制图片" : "复制代码"
            }
          >
            {copyingImage ? (
              <GooseIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : copied ? (
              <GooseIcons.Check
                className={cn(
                  "h-3.5 w-3.5",
                  "text-[var(--goose-color-success)]",
                )}
              />
            ) : (
              <GooseIcons.Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {copied ? "已复制" : onCopyPreview ? "复制图片" : "复制代码"}
        </TooltipContent>
      </Tooltip>

      <div
        className="goose-code-display-toggle inline-flex h-7 items-center gap-0.5 rounded-[12px] p-0.5"
        role="tablist"
        aria-label="代码块显示模式"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="tab"
          aria-selected={previewMode === "code"}
          aria-label="显示代码"
          onClick={() => onPreviewModeChange?.("code")}
          className={cn(
            "goose-code-display-toggle-button h-6 px-2.5 text-xs",
            chipClass,
            previewMode === "code" && "goose-code-action-active",
          )}
        >
          代码
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="tab"
          aria-selected={previewMode === "preview"}
          aria-label="显示预览"
          onClick={() => onPreviewModeChange?.("preview")}
          disabled={!canPreview}
          className={cn(
            "goose-code-display-toggle-button h-6 px-2.5 text-xs",
            chipClass,
            previewMode === "preview" && "goose-code-action-active",
          )}
        >
          预览
        </Button>
      </div>
    </>
  );
}
