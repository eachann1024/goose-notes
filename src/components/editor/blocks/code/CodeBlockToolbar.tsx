import { useState, useMemo, useEffect, useRef } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFormatCode } from "@/components/editor/hooks/useFormatCode";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  FORMAT_SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  POPULAR_LANGUAGES,
} from "@/components/editor/blocks/code/codeBlockLanguages";

interface CodeBlockToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  getCodeContent: () => string;
  onFormat?: (formatted: string) => void;
  onWrapChange?: (wrap: boolean) => void;
  wrap?: boolean;
  editable?: boolean;
}

export function CodeBlockToolbar({
  language,
  onLanguageChange,
  getCodeContent,
  onFormat,
  onWrapChange,
  wrap = false,
  editable = true,
}: CodeBlockToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { format, isLoading } = useFormatCode();
  const platform = useEditorPlatform();

  const displayLanguage = language
    ? LANGUAGE_DISPLAY_NAMES[language.toLowerCase()] || language
    : "Plain Text";

  const handleCopy = () => {
    void platform.clipboard.copyText(getCodeContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      let si = 0, ti = 0;
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
      const aN = a.toLowerCase(), bN = b.toLowerCase();
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

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
    else setSearch("");
  }, [isOpen]);

  const canFormat = FORMAT_SUPPORTED_LANGUAGES.includes((language || "").toLowerCase());
  const isMathOrMermaid = language === "math" || language === "mermaid";
  const chipClass = cn(
    "transition-colors duration-150",
    "border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
    "hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
    "focus-visible:ring-0 focus-visible:ring-offset-0",
    "cursor-pointer rounded-md",
  );
  const chipActiveClass =
    "border-[var(--goose-block-subtle-border)] bg-[var(--goose-interactive-selected)] text-foreground hover:bg-[var(--goose-interactive-selected)]";
  const iconSize = "h-3.5 w-3.5";

  return (
    <TooltipProvider delayDuration={600}>
      <div contentEditable={false} className="goose-code-toolbar-actions inline-flex items-center">
        <div className="flex shrink-0 items-center gap-1">
          {editable && !isMathOrMermaid ? (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
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
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 max-h-64 overflow-y-auto text-xs"
              >
                <div className="pb-2">
                  <Input
                    ref={inputRef}
                    placeholder="搜索语言..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                  />
                </div>
                {!search && (
                  <DropdownMenuLabel className="text-xs">常用语言</DropdownMenuLabel>
                )}
                {filteredLanguages.map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onSelect={() => {
                      onLanguageChange(lang);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "text-xs",
                      lang.toLowerCase() === language.toLowerCase() && "bg-accent",
                    )}
                  >
                    {LANGUAGE_DISPLAY_NAMES[lang] || lang}
                    {lang.toLowerCase() === language.toLowerCase() && (
                      <span className="ml-auto">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="inline-flex h-6 cursor-default items-center rounded-md bg-[var(--goose-block-subtle-bg)] px-1.5 font-mono text-[11px] text-muted-foreground">
              {displayLanguage}
            </div>
          )}

          {editable && onWrapChange && !isMathOrMermaid && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={wrap ? "取消换行" : "自动换行"}
                  onClick={() => onWrapChange(!wrap)}
                  className={cn("h-6 w-6 p-0", chipClass, wrap && chipActiveClass)}
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
                    <LucideIcons.Loader2 className={cn(iconSize, "animate-spin")} />
                  ) : (
                    <LucideIcons.Sparkles className={iconSize} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>格式化代码</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={cn("h-6 w-6 p-0", chipClass)}
              >
                {copied ? (
                  <LucideIcons.Check className={cn(iconSize, "text-[var(--goose-color-success)]")} />
                ) : (
                  <LucideIcons.Copy className={iconSize} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "已复制" : "复制代码"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
