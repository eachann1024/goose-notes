import { BubbleMenu } from "@tiptap/react/menus";
import { ColorPicker } from "./ColorPicker";

type EditorBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

import { useScrollHide } from "@/hooks/useScrollHide";

const TOOLTIP_STYLE =
  "z-[12050] rounded-lg border-0 bg-[#1f1f1f] px-2 py-1.5 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)]";

function BubbleMenuTooltip({
  label,
  shortcut,
}: {
  label: string;
  shortcut?: string;
}) {
  return (
    <TooltipContent side="top" sideOffset={8} className={TOOLTIP_STYLE}>
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="text-[12px] font-medium text-white">{label}</span>
        {shortcut ? (
          <span className="text-[11px] text-white/75">
            {formatShortcut(shortcut)}
          </span>
        ) : null}
      </div>
    </TooltipContent>
  );
}

export function EditorBubbleMenu({ editor, ...props }: EditorBubbleMenuProps) {
  const isHidden = useScrollHide(editor);

  if (!editor) return null;

  return (
    <TooltipProvider>
      <BubbleMenu
        editor={editor}
        appendTo={() => document.body}
        className={cn(
          "z-[9999] flex items-center gap-0.5 rounded-[10px] border border-black/10 bg-popover/95 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.18),0_1px_3px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-opacity duration-200 dark:border-white/10 dark:bg-[#2f3437]/95",
          isHidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        shouldShow={({ editor, state }) => {
          if (!editor.isEditable) return false;
          const { selection } = state;

          // 标题不显示工具栏
          if (editor.isActive("heading", { level: 1 })) {
            return false;
          }

          if (
            editor.isActive("image") ||
            editor.isActive("table") ||
            editor.isActive("link") ||
            editor.isActive("codeBlock") ||
            editor.isActive("inlineMath") ||
            "node" in selection
          ) {
            return false;
          }

          return !selection.empty;
        }}
        {...props}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("bold")}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
              aria-label="粗体"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Bold className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="粗体" shortcut="Mod+B" />
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("italic")}
              onPressedChange={() =>
                editor.chain().focus().toggleItalic().run()
              }
              aria-label="斜体"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Italic className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="斜体" shortcut="Mod+I" />
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("strike")}
              onPressedChange={() =>
                editor.chain().focus().toggleStrike().run()
              }
              aria-label="删除线"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Strikethrough className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="删除线" shortcut="Mod+Shift+S" />
        </Tooltip>

        <ColorPicker editor={editor} />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("underline")}
              onPressedChange={() =>
                editor.chain().focus().toggleUnderline().run()
              }
              aria-label="下划线"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Underline className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="下划线" shortcut="Mod+U" />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("code")}
              onPressedChange={() => editor.chain().focus().toggleCode().run()}
              aria-label="行内代码"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.Code className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="行内代码" shortcut="Mod+E" />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive({ textAlign: "left" })}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              aria-label="左对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignLeft className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="左对齐" shortcut="Mod+Shift+L" />
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive({ textAlign: "center" })}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              aria-label="居中对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignCenter className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="居中对齐" shortcut="Mod+Shift+E" />
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive({ textAlign: "right" })}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              aria-label="右对齐"
              className="h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground"
            >
              <LucideIcons.AlignRight className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <BubbleMenuTooltip label="右对齐" shortcut="Mod+Shift+R" />
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().unsetTextAlign().run()
              }
              aria-label="清除格式"
              className="h-7 w-7 rounded-md p-0 text-foreground/90 hover:bg-muted"
            >
              <LucideIcons.Eraser className="h-[15px] w-[15px]" />
            </Button>
          </TooltipTrigger>
          <BubbleMenuTooltip label="清除格式" />
        </Tooltip>
      </BubbleMenu>
    </TooltipProvider>
  );
}
