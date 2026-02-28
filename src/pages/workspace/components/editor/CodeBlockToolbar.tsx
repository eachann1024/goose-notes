import { useFormatCode } from "@/hooks/useFormatCode";
import {
  FORMAT_SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  POPULAR_LANGUAGES,
} from "./codeBlockLanguages";

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

  const displayLanguage = language
    ? LANGUAGE_DISPLAY_NAMES[language.toLowerCase()] || language
    : "Code";

  const handleCopy = async () => {
    UToolsAdapter.copyToClipboard(getCodeContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatClick = async () => {
    if (!onFormat) return;
    const content = getCodeContent();
    if (!content) return;

    const formatted = await format(content, language || "text");
    if (formatted) {
      onFormat(formatted);
    }
  };

  /* Fuzzy match logic */
  const filteredLanguages = useMemo(() => {
    if (!search) return POPULAR_LANGUAGES;

    const lowerSearch = search.toLowerCase();
    
    // Fuzzy match function
    const fuzzyMatch = (text: string) => {
      let searchIdx = 0;
      let textIdx = 0;
      const lowerText = text.toLowerCase();
      
      while (searchIdx < lowerSearch.length && textIdx < lowerText.length) {
        if (lowerSearch[searchIdx] === lowerText[textIdx]) {
          searchIdx++;
        }
        textIdx++;
      }
      return searchIdx === lowerSearch.length;
    };

    return POPULAR_LANGUAGES.filter((lang) => {
      const displayName = LANGUAGE_DISPLAY_NAMES[lang] || lang;
      return fuzzyMatch(lang) || fuzzyMatch(displayName);
    }).sort((a, b) => {
      const aName = a.toLowerCase();
      const bName = b.toLowerCase();
      const aDisplay = (LANGUAGE_DISPLAY_NAMES[a] || a).toLowerCase();
      const bDisplay = (LANGUAGE_DISPLAY_NAMES[b] || b).toLowerCase();

      // Priority 1: Exact match
      if (aName === lowerSearch) return -1;
      if (bName === lowerSearch) return 1;

      // Priority 2: Starts with (checking key and display name)
      const aStarts = aName.startsWith(lowerSearch) || aDisplay.startsWith(lowerSearch);
      const bStarts = bName.startsWith(lowerSearch) || bDisplay.startsWith(lowerSearch);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Priority 3: Contains
      const aIncludes = aName.includes(lowerSearch) || aDisplay.includes(lowerSearch);
      const bIncludes = bName.includes(lowerSearch) || bDisplay.includes(lowerSearch);

      if (aIncludes && !bIncludes) return -1;
      if (!aIncludes && bIncludes) return 1;

      return 0; // Keep original order for fuzzy matches
    });
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const canFormat = FORMAT_SUPPORTED_LANGUAGES.includes(
    (language || "").toLowerCase(),
  );
  const isMathOrMermaid = language === "math" || language === "mermaid";
  const toolbarChipClass = cn(
    "transition-colors duration-150",
    "border-0 bg-[var(--code-toolbar-chip-bg)] text-[var(--code-toolbar-chip-fg)] shadow-none",
    "hover:bg-[var(--code-toolbar-chip-hover-bg)] hover:text-[var(--code-toolbar-chip-fg)]",
    "focus-visible:ring-0 focus-visible:ring-offset-0",
    "cursor-pointer",
    "rounded-md",
  );
  const toolbarChipActiveClass =
    "code-toolbar-chip-active bg-[var(--code-toolbar-chip-active-bg)] text-[var(--code-toolbar-chip-active-fg)] hover:bg-[var(--code-toolbar-chip-active-bg)]";

  return (
    <TooltipProvider>
      <div
        contentEditable={false}
        suppressContentEditableWarning
        className="code-block-toolbar-actions inline-flex items-center gap-1 rounded-md p-1"
      >
        <div className="code-block-toolbar-controls flex shrink-0 items-center gap-1">
          {editable && !isMathOrMermaid ? (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "code-toolbar-language-trigger h-7 min-w-7 px-2 text-xs font-mono",
                    toolbarChipClass,
                    isOpen && toolbarChipActiveClass,
                  )}
                >
                  {displayLanguage}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 max-h-64 overflow-y-auto"
              >
                <div className="p-2 border-b">
                  <Input
                    ref={inputRef}
                    placeholder="搜索语言..."
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSearch(e.target.value)
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                  />
                </div>

                {!search && <DropdownMenuLabel>常用语言</DropdownMenuLabel>}

                {filteredLanguages.map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onSelect={() => {
                      onLanguageChange(lang);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "text-xs",
                      lang.toLowerCase() === language.toLowerCase() &&
                        "bg-accent",
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
            <div
              className={cn(
                "inline-flex h-7 min-w-7 cursor-default items-center rounded-md border-0 bg-[hsl(var(--muted)/0.65)] px-2 text-[10px] font-mono text-[color:var(--code-fg)]",
              )}
            >
              {displayLanguage}
            </div>
          )}

          {editable && onWrapChange && !isMathOrMermaid && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={wrap ? "取消代码换行" : "开启代码换行"}
                  aria-pressed={wrap}
                  onClick={() => onWrapChange(!wrap)}
                  className={cn(
                    "code-toolbar-wrap-toggle h-7 min-w-7 p-0",
                    toolbarChipClass,
                    wrap && toolbarChipActiveClass,
                  )}
                >
                  {wrap ? (
                    <LucideIcons.AlignJustify className="h-3.5 w-3.5" />
                  ) : (
                    <LucideIcons.WrapText className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{wrap ? "取消换行" : "自动换行"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {editable && onFormat && canFormat && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFormatClick}
                  disabled={isLoading}
                  className={cn(
                    "h-7 min-w-7 p-0",
                    toolbarChipClass,
                  )}
                >
                  {isLoading ? (
                    <LucideIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LucideIcons.Sparkles className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>格式化代码</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  "h-7 min-w-7 p-0",
                  toolbarChipClass,
                )}
              >
                {copied ? (
                  <LucideIcons.Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <LucideIcons.Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? "已复制" : "复制代码"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
