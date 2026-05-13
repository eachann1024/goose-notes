import {
  useBlockNoteEditor,
  useActiveStyles,
  useSelectedBlocks,
} from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/stores/useSettings";
import { useContextMenu } from "@/stores/useContextMenu";
import { useGlobalScrollActivity } from "@/hooks/useGlobalScrollActivity";
import { Kbd } from "@/components/ui/kbd";
import { FormattingToolbarColorPicker } from "./FormattingToolbarColorPicker";
import type { DefaultBlockSchema } from "@blocknote/core";

function ToolbarTooltip({
  label,
  shortcut,
}: {
  label: string;
  shortcut?: string;
}) {
  return (
    <TooltipContent side="top" sideOffset={8}>
      <div className="inline-flex items-center gap-2 leading-none whitespace-nowrap">
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        {shortcut ? <Kbd shortcut={shortcut} /> : null}
      </div>
    </TooltipContent>
  );
}

export function EditorFormattingToolbar() {
  const editor = useBlockNoteEditor();
  const activeStyles = useActiveStyles();
  const selectedBlocks = useSelectedBlocks();
  const aiEnabled = useSettings((state) => state.ai.enabled);
  const openMenuId = useContextMenu((state) => state.openMenuId);
  const isContextMenuOpen = Boolean(openMenuId);
  const scrollActivity = useGlobalScrollActivity({ idleMs: 120 });
  const isScrolling = scrollActivity.isScrolling;

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const bindTooltip = useCallback(
    (id: string) => ({
      delayDuration: 0,
      open: activeTooltip === id,
      onOpenChange: (open: boolean) =>
        setActiveTooltip((prev) => (open ? id : prev === id ? null : prev)),
    }),
    [activeTooltip]
  );

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.zIndex = "20000";
  }, []);

  useEffect(() => {
    if (!isScrolling && !isContextMenuOpen) return;
    setActiveTooltip(null);
  }, [isScrolling, isContextMenuOpen]);

  const isBold = !!activeStyles.bold;
  const isItalic = !!activeStyles.italic;
  const isStrike = !!activeStyles.strike;
  const isUnderline = !!activeStyles.underline;
  const isCode = !!activeStyles.code;

  // textAlignment is a block prop, check first selected block
  const firstBlock = selectedBlocks[0];
  const textAlignment =
    (firstBlock?.props as { textAlignment?: string } | undefined)
      ?.textAlignment ?? "left";

  const isHeading = firstBlock?.type === "heading";
  const isToggleable =
    isHeading &&
    (firstBlock?.props as { isToggleable?: boolean } | undefined)
      ?.isToggleable;

  const linkUrl = editor.getSelectedLinkUrl();
  const isLinkActive = !!linkUrl;

  const setTextAlignment = useCallback(
    (alignment: "left" | "center" | "right") => {
      for (const block of selectedBlocks) {
        editor.updateBlock(block, {
          props: { textAlignment: alignment },
        });
      }
    },
    [editor, selectedBlocks]
  );

  const clearFormatting = useCallback(() => {
    editor.removeStyles({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      code: true,
      textColor: true,
      backgroundColor: true,
    } as any);
    for (const block of selectedBlocks) {
      editor.updateBlock(block, {
        props: { textAlignment: "left" },
      });
    }
  }, [editor, selectedBlocks]);

  const shouldHide = isScrolling || isContextMenuOpen;

  return (
    <TooltipProvider
      delayDuration={0}
      skipDelayDuration={0}
      disableHoverableContent
    >
      <div
        ref={menuRef}
        className="z-[20000] flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] transition-opacity duration-200 dark:border-white/15 dark:bg-[#2f3437]"
        style={{
          opacity: shouldHide ? 0 : 1,
          pointerEvents: shouldHide ? "none" : "auto",
        }}
      >
        {aiEnabled && (
          <>
            <Tooltip {...bindTooltip("ai-polish")}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    let overrideRect = undefined;
                    if (menuRef.current) {
                      const rect = menuRef.current.getBoundingClientRect();
                      overrideRect = {
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                      };
                    }
                    document.dispatchEvent(
                      new CustomEvent("open-ai-input-popover", {
                        detail: {
                          editor,
                          initialAction: "polish",
                          overrideRect,
                        },
                      })
                    );
                  }}
                  aria-label="AI 润色"
                  className="h-7 w-7 rounded-md p-0 text-[#10b981] hover:bg-muted hover:text-[#10b981]"
                >
                  <LucideIcons.Sparkles className="h-[15px] w-[15px]" />
                </Button>
              </TooltipTrigger>
              <ToolbarTooltip label="AI 润色" />
            </Tooltip>

            <Separator
              orientation="vertical"
              className="h-5 opacity-70 mx-0.5"
            />
          </>
        )}

        <Tooltip {...bindTooltip("bold")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isBold}
              onPressedChange={() =>
                editor.toggleStyles({ bold: true })
              }
              aria-label="粗体"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Bold className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="粗体" shortcut="Mod+B" />
        </Tooltip>

        <Tooltip {...bindTooltip("italic")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isItalic}
              onPressedChange={() =>
                editor.toggleStyles({ italic: true })
              }
              aria-label="斜体"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Italic className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="斜体" shortcut="Mod+I" />
        </Tooltip>

        <Tooltip {...bindTooltip("strike")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isStrike}
              onPressedChange={() =>
                editor.toggleStyles({ strike: true })
              }
              aria-label="删除线"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Strikethrough className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="删除线" shortcut="Mod+Shift+S" />
        </Tooltip>

        <FormattingToolbarColorPicker />

        <Tooltip {...bindTooltip("underline")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isUnderline}
              onPressedChange={() =>
                editor.toggleStyles({ underline: true })
              }
              aria-label="下划线"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Underline className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="下划线" shortcut="Mod+U" />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip {...bindTooltip("code")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isCode}
              onPressedChange={() =>
                editor.toggleStyles({ code: true })
              }
              aria-label="行内代码"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Code className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="行内代码" shortcut="Mod+E" />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip {...bindTooltip("link")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={isLinkActive}
              onPressedChange={() => {
                if (isLinkActive) {
                  editor.deleteLink();
                } else {
                  const url = window.prompt("输入链接地址:");
                  if (url) {
                    editor.createLink(url);
                  }
                }
              }}
              aria-label="链接"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Link className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label={isLinkActive ? "移除链接" : "添加链接"} />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip {...bindTooltip("align-left")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={textAlignment === "left"}
              onPressedChange={() => setTextAlignment("left")}
              aria-label="左对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignLeft className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="左对齐" shortcut="Mod+Shift+L" />
        </Tooltip>

        <Tooltip {...bindTooltip("align-center")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={textAlignment === "center"}
              onPressedChange={() => setTextAlignment("center")}
              aria-label="居中对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignCenter className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="居中对齐" shortcut="Mod+Shift+E" />
        </Tooltip>

        <Tooltip {...bindTooltip("align-right")}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={textAlignment === "right"}
              onPressedChange={() => setTextAlignment("right")}
              aria-label="右对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignRight className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label="右对齐" shortcut="Mod+Shift+R" />
        </Tooltip>

        {isHeading && (
          <>
            <Separator orientation="vertical" className="h-5 opacity-70" />
            <Tooltip {...bindTooltip("heading-toggle")}>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={!!isToggleable}
                  onPressedChange={() => {
                    for (const block of selectedBlocks) {
                      if (block.type === "heading") {
                        editor.updateBlock(block, {
                          props: {
                            isToggleable: !isToggleable,
                          },
                        });
                      }
                    }
                  }}
                  aria-label="折叠子内容"
                  className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
                >
                  <LucideIcons.ChevronRight className="h-[15px] w-[15px]" />
                </Toggle>
              </TooltipTrigger>
              <ToolbarTooltip label="折叠子内容" />
            </Tooltip>
          </>
        )}

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip {...bindTooltip("clear")}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFormatting}
              aria-label="清除格式"
              className="h-7 w-7 rounded-md p-0 text-foreground/90 hover:bg-muted"
            >
              <LucideIcons.Eraser className="h-[15px] w-[15px]" />
            </Button>
          </TooltipTrigger>
          <ToolbarTooltip label="清除格式" />
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
