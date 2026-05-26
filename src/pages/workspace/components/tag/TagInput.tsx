import { useState, useRef, useCallback } from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { suggestTags } from "@/lib/ai-tagging";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { toast } from "sonner";
import type { Page } from "@/types";

interface TagInputProps {
  page: Page;
  disabled?: boolean;
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, "").trim();
}

export function TagInput({ page, disabled }: TagInputProps) {
  const updatePage = usePages((s) => s.updatePage);
  const aiSettings = useSettings((s) => s.ai);
  const allPages = usePages((s) => s.pages);

  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = Array.isArray(page.tags) ? page.tags : [];

  const setTags = useCallback(
    (next: string[]) => {
      const deduped = Array.from(new Set(next.map(normalizeTag).filter(Boolean)));
      updatePage(page.id, { tags: deduped });
    },
    [page.id, updatePage],
  );

  const handleAdd = useCallback(
    (raw: string) => {
      const t = normalizeTag(raw);
      if (!t) return;
      if (tags.includes(t)) return;
      setTags([...tags, t]);
    },
    [tags, setTags],
  );

  const handleRemove = useCallback(
    (tag: string) => {
      setTags(tags.filter((t) => t !== tag));
    },
    [tags, setTags],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAdd(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && tags.length) {
      handleRemove(tags[tags.length - 1]);
    }
  };

  const handleSuggest = useCallback(async () => {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestions([]);
    try {
      const existing = new Set<string>();
      Object.values(allPages).forEach((p) => {
        if (Array.isArray(p.tags)) p.tags.forEach((t) => existing.add(t));
      });
      const result = await suggestTags({
        settings: aiSettings as any,
        page,
        existingTags: Array.from(existing),
      });
      const fresh = result.filter((t) => !tags.includes(t));
      if (!fresh.length) {
        toast.info("AI 没给出新的标签建议");
      } else {
        setSuggestions(fresh);
      }
    } catch (err) {
      console.warn("[TagInput] suggest failed:", err);
      toast.error("AI 建议失败");
    } finally {
      setSuggesting(false);
    }
  }, [suggesting, allPages, aiSettings, page, tags]);

  if (disabled) return null;

  return (
    <div className="mb-2">
      <div className="group/tags flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80 transition hover:bg-muted/80"
          >
            <span className="font-medium">#{tag}</span>
            <button
              type="button"
              className="opacity-0 transition group-hover/tags:opacity-100 hover:text-foreground"
              onClick={() => handleRemove(tag)}
              aria-label={`移除标签 ${tag}`}
            >
              <LucideIcons.X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft) {
              handleAdd(draft);
              setDraft("");
            }
          }}
          placeholder={tags.length ? "" : "添加标签…"}
          className={cn(
            "min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60",
            "py-0.5",
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-60 hover:opacity-100"
          onClick={handleSuggest}
          disabled={suggesting}
          title="AI 建议标签"
        >
          {suggesting ? (
            <LucideIcons.Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LucideIcons.Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          )}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">AI 建议:</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400"
              onClick={() => {
                handleAdd(tag);
                setSuggestions((prev) => prev.filter((t) => t !== tag));
              }}
            >
              + #{tag}
            </button>
          ))}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSuggestions([])}
          >
            <LucideIcons.X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
