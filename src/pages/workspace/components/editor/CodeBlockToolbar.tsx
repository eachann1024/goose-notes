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
  editable?: boolean;
}

export function CodeBlockToolbar({
  language,
  onLanguageChange,
  getCodeContent,
  onFormat,
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
    await navigator.clipboard.writeText(getCodeContent());
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

  const filteredLanguages = search
    ? POPULAR_LANGUAGES.filter(
        (lang) =>
          lang.toLowerCase().includes(search.toLowerCase()) ||
          LANGUAGE_DISPLAY_NAMES[lang]
            ?.toLowerCase()
            .includes(search.toLowerCase()),
      )
    : POPULAR_LANGUAGES;

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

  return (
    <TooltipProvider>
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {editable ? (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs font-mono rounded-md",
                  "bg-background/80 hover:bg-background/90",
                  "border border-border/50",
                  "backdrop-blur-sm",
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
              "h-6 px-2 flex items-center text-[10px] font-mono rounded-md",
              "bg-background/80 text-muted-foreground/70",
              "border border-border/50",
              "backdrop-blur-sm",
            )}
          >
            {displayLanguage}
          </div>
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
                  "h-6 w-6 p-0 rounded-md",
                  "bg-background/80 hover:bg-background/90",
                  "border border-border/50",
                  "backdrop-blur-sm",
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
                "h-6 w-6 p-0 rounded-md",
                "bg-background/80 hover:bg-background/90",
                "border border-border/50",
                "backdrop-blur-sm",
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
    </TooltipProvider>
  );
}
