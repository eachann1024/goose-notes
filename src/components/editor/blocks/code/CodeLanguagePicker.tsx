import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverAction,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LANGUAGE_DISPLAY_NAMES,
  POPULAR_LANGUAGES,
} from "./codeBlockLanguages";
import {
  defaultLanguageHighlightIndex,
  moveLanguageHighlightIndex,
} from "./codeBlockLanguageNav";
import type { CodeBlockToolbarProps } from "./codeToolbarTypes";

export function CodeLanguagePicker({
  language,
  onLanguageChange,
  editable,
  isMathOrMermaid,
  hasVisualPreview,
  displayLanguage,
  chipClass,
  chipActiveClass,
}: Pick<CodeBlockToolbarProps, "language" | "onLanguageChange" | "editable"> & {
  isMathOrMermaid: boolean;
  hasVisualPreview: boolean;
  displayLanguage: string;
  chipClass: string;
  chipActiveClass: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const languageListId = useId();

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

  return (
    <>
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
                placeholder="搜索语言…"
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
    </>
  );
}
