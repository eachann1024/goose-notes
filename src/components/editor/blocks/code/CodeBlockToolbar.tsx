import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useCallback,
} from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverAction,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFormatCode } from "@/components/editor/hooks/useFormatCode";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  PREVIEW_ACTION_TOOLTIP,
  previewPointerHandlers,
} from "@/lib/preview/previewAction";
import {
  FORMAT_SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  POPULAR_LANGUAGES,
} from "@/components/editor/blocks/code/codeBlockLanguages";
import {
  defaultLanguageHighlightIndex,
  moveLanguageHighlightIndex,
} from "@/components/editor/blocks/code/codeBlockLanguageNav";

interface CodeBlockToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  getCodeContent: () => string;
  onFormat?: (formatted: string) => void;
  onWrapChange?: (wrap: boolean) => void;
  wrap?: boolean;
  editable?: boolean;
  previewMode?: "code" | "preview";
  onPreviewModeChange?: (mode: "code" | "preview") => void;
  onOpenPreview?: () => void;
  onSystemPreview?: () => void;
  onDownloadPreview?: () => void;
  /** 复制渲染后的预览图（Mermaid / Math），未提供时退回复制源码 */
  onCopyPreview?: () => void | Promise<void>;
  canPreview?: boolean;
}

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
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const languageListId = useId();
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

  const filteredLanguages = useMemo(() => {
    if (!search) return POPULAR_LANGUAGES;
    const lowerSearch = search.toLowerCase();
    const fuzzyMatch = (text: string) => {
      let si = 0,
        ti = 0;
      const lt = text.toLowerCase();
      while (si < lowerSearch.length && ti < lt.length) {
        if (lowerSearch[si] === lt[ti]) si++;
        ti++;
      }
      return si === lowerSearch.length;
    };
    return POPULAR_LANGUAGES.filter((lang) => {
      const displayName = LANGUAGE_DISPLAY_NAMES[lang] || lang;
      return fuzzyMatch(lang) || fuzzyMatch(displayName);
    }).sort((a, b) => {
      const aN = a.toLowerCase(),
        bN = b.toLowerCase();
      const aD = (LANGUAGE_DISPLAY_NAMES[a] || a).toLowerCase();
      const bD = (LANGUAGE_DISPLAY_NAMES[b] || b).toLowerCase();
      if (aN === lowerSearch) return -1;
      if (bN === lowerSearch) return 1;
      const aS = aN.startsWith(lowerSearch) || aD.startsWith(lowerSearch);
      const bS = bN.startsWith(lowerSearch) || bD.startsWith(lowerSearch);
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      const aI = aN.includes(lowerSearch) || aD.includes(lowerSearch);
      const bI = bN.includes(lowerSearch) || bD.includes(lowerSearch);
      if (aI && !bI) return -1;
      if (!aI && bI) return 1;
      return 0;
    });
  }, [search]);

  const safeHighlightedIndex =
    filteredLanguages.length === 0
      ? 0
      : Math.min(highlightedIndex, filteredLanguages.length - 1);

  const selectLanguage = useCallback(
    (lang: string) => {
      onLanguageChange(lang);
      setIsOpen(false);
    },
    [onLanguageChange],
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;

      const count = filteredLanguages.length;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (count === 0) return;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setHighlightedIndex((current) =>
          moveLanguageHighlightIndex(current, count, delta),
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const lang = filteredLanguages[safeHighlightedIndex];
        if (lang) selectLanguage(lang);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    },
    [filteredLanguages, safeHighlightedIndex, selectLanguage],
  );

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
    setSearch("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(
      defaultLanguageHighlightIndex(filteredLanguages, search, language),
    );
  }, [isOpen, search, language, filteredLanguages]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    document
      .getElementById(`${languageListId}-opt-${safeHighlightedIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, languageListId, safeHighlightedIndex]);

  const canFormat = FORMAT_SUPPORTED_LANGUAGES.includes(
    (language || "").toLowerCase(),
  );
  const isMathOrMermaid = language === "math" || language === "mermaid";
  const hasVisualPreview = isMathOrMermaid && Boolean(onPreviewModeChange);
  const chipClass = cn(
    "transition-colors duration-150",
    "border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
    "hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
    "focus-visible:ring-0 focus-visible:ring-offset-0",
    "cursor-pointer rounded-md",
  );
  const chipActiveClass =
    "border-[var(--goose-block-subtle-border)] bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] hover:bg-[var(--goose-interactive-selected)]";
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
          {editable && !isMathOrMermaid ? (
            <Popover
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (open) {
                  setHighlightedIndex(
                    defaultLanguageHighlightIndex(
                      filteredLanguages,
                      search,
                      language,
                    ),
                  );
                } else {
                  setHighlightedIndex(0);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "goose-code-lang-trigger h-6 min-w-6 px-1.5 font-mono text-xs",
                    chipClass,
                    isOpen && chipActiveClass,
                  )}
                >
                  {displayLanguage}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                editorContext
                className="w-48 max-h-64 overflow-y-auto text-xs"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                }}
              >
                <div className="pb-2">
                  <Input
                    ref={inputRef}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-controls={languageListId}
                    aria-activedescendant={
                      filteredLanguages[safeHighlightedIndex]
                        ? `${languageListId}-opt-${safeHighlightedIndex}`
                        : undefined
                    }
                    placeholder="搜索语言..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="h-7 text-xs"
                  />
                </div>
                {!search && <div className="text-xs">常用语言</div>}
                <div id={languageListId} role="listbox" aria-label="代码语言">
                  {filteredLanguages.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      未找到语言
                    </div>
                  ) : null}
                  {filteredLanguages.map((lang, index) => (
                    <PopoverAction
                      key={lang}
                      id={`${languageListId}-opt-${index}`}
                      role="option"
                      aria-selected={index === safeHighlightedIndex}
                      data-goose-lang-highlighted={
                        index === safeHighlightedIndex ? "true" : undefined
                      }
                      onPointerMove={(event) => {
                        event.preventDefault();
                        setHighlightedIndex(index);
                      }}
                      onSelect={() => {
                        selectLanguage(lang);
                      }}
                      className={cn(
                        "text-xs",
                        index === safeHighlightedIndex &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]",
                      )}
                    >
                      {LANGUAGE_DISPLAY_NAMES[lang] || lang}
                      {lang.toLowerCase() === language.toLowerCase() && (
                        <span className="ml-auto">✓</span>
                      )}
                    </PopoverAction>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            !hasVisualPreview && (
              <div className="inline-flex h-6 cursor-default items-center rounded-md bg-[var(--goose-block-subtle-bg)] px-1.5 font-mono text-[11px] text-muted-foreground">
                {displayLanguage}
              </div>
            )
          )}

          {hasVisualPreview && (
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
                    <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
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
                    <LucideIcons.Download className="h-3.5 w-3.5" />
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
                    disabled={
                      copyingImage || (Boolean(onCopyPreview) && !canPreview)
                    }
                    className={cn("h-7 w-7 p-0", chipClass)}
                    aria-label={
                      copied
                        ? "已复制"
                        : onCopyPreview
                          ? "复制图片"
                          : "复制代码"
                    }
                  >
                    {copyingImage ? (
                      <LucideIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : copied ? (
                      <LucideIcons.Check
                        className={cn(
                          "h-3.5 w-3.5",
                          "text-[var(--goose-color-success)]",
                        )}
                      />
                    ) : (
                      <LucideIcons.Copy className="h-3.5 w-3.5" />
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
                    <LucideIcons.AlignJustify className={iconSize} />
                  ) : (
                    <LucideIcons.WrapText className={iconSize} />
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
                    <LucideIcons.Loader2
                      className={cn(iconSize, "animate-spin")}
                    />
                  ) : (
                    <LucideIcons.Sparkles className={iconSize} />
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
                    <LucideIcons.Check
                      className={cn(
                        iconSize,
                        "text-[var(--goose-color-success)]",
                      )}
                    />
                  ) : (
                    <LucideIcons.Copy className={iconSize} />
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
