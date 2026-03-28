import { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AiResolvedTarget, AiTargetSelection } from "@/lib/ai-write";
import { getAiReferenceSuggestionItems } from "../editor/ai-composer/referenceLookup";

interface AiTargetSelectorProps {
  resolvedTarget: AiResolvedTarget;
  onSelectTarget: (selection: AiTargetSelection) => void;
}

const TARGET_MODE_ITEMS = [
  {
    mode: "current_page",
    label: "当前页",
    description: "直接写到这页",
  },
  {
    mode: "current_notebook",
    label: "新页面",
    description: "在当前记事本新建",
  },
  {
    mode: "chat_only",
    label: "仅聊天",
    description: "只回答，不写入",
  },
] as const;

function getTargetTriggerMeta(target: AiResolvedTarget) {
  if (target.mode === "chat_only") {
    return {
      label: "仅聊天",
      Icon: LucideIcons.MessageSquareMore,
    };
  }

  if (target.mode === "specific_page") {
    return {
      label: target.pageTitle || "指定页面",
      Icon: target.isFolder ? LucideIcons.FolderOpen : LucideIcons.FileText,
    };
  }

  if (target.mode === "current_page") {
    return {
      label: "当前页",
      Icon: LucideIcons.FilePenLine,
    };
  }

  return {
    label: "新页面",
    Icon: LucideIcons.FilePlus2,
  };
}

export function AiTargetSelector({
  resolvedTarget,
  onSelectTarget,
}: AiTargetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerMeta = getTargetTriggerMeta(resolvedTarget);
  const specificPageItems = useMemo(
    () =>
      getAiReferenceSuggestionItems(query, {
        includeFolders: true,
      }),
    [query],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 max-w-[220px] items-center gap-2 rounded-full border border-border/70 bg-muted/25 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/45"
        >
          <triggerMeta.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{triggerMeta.label}</span>
          <LucideIcons.ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[320px] rounded-[18px] border border-border/75 bg-popover p-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
      >
        <div className="space-y-1">
          {TARGET_MODE_ITEMS.map((item) => {
            const selected = resolvedTarget.mode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/65",
                )}
                onClick={() => {
                  onSelectTarget({
                    mode: item.mode,
                    manual: true,
                  });
                  setOpen(false);
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/80">
                  {item.mode === "current_page" ? (
                    <LucideIcons.FilePenLine className="h-4 w-4 text-muted-foreground" />
                  ) : item.mode === "chat_only" ? (
                    <LucideIcons.MessageSquareMore className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <LucideIcons.FilePlus2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="my-2 h-px bg-border/70" />

        <div className="space-y-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索指定页面或文件夹"
            className="h-9"
          />
          <div className="max-h-[260px] space-y-1 overflow-y-auto">
            {specificPageItems.map((item) => {
              const Icon = item.isFolder
                ? LucideIcons.FolderOpen
                : item.sourceType === "local-file"
                  ? LucideIcons.FileText
                  : LucideIcons.NotebookText;
              return (
                <button
                  key={item.pageId}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent/65",
                    resolvedTarget.mode === "specific_page" && resolvedTarget.pageId === item.pageId
                      ? "bg-accent text-accent-foreground"
                      : "",
                  )}
                  onClick={() => {
                    onSelectTarget({
                      mode: "specific_page",
                      pageId: item.pageId,
                      manual: true,
                    });
                    setOpen(false);
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/60">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
            {specificPageItems.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                没找到可用目标
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
