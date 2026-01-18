import { BubbleMenu } from "@tiptap/react/menus";
import { ColorPicker } from "./ColorPicker";

type EditorBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

export function EditorBubbleMenu({ editor, ...props }: EditorBubbleMenuProps) {
  if (!editor) return null;

  return (
    <TooltipProvider>
      <BubbleMenu
        editor={editor}
        className="flex items-center space-x-1 rounded-md border border-border bg-popover p-1 shadow-md backdrop-blur-sm"
        shouldShow={({ editor, state }) => {
          if (!editor.isEditable) return false;
          const { selection } = state;

          if (
            editor.isActive("image") ||
            editor.isActive("table") ||
            editor.isActive("link") ||
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
              className="text-foreground"
            >
              <LucideIcons.Bold className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>粗体</p>
          </TooltipContent>
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
              className="text-foreground"
            >
              <LucideIcons.Italic className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>斜体</p>
          </TooltipContent>
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
              className="text-foreground"
            >
              <LucideIcons.Strikethrough className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除线</p>
          </TooltipContent>
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
              className="text-foreground"
            >
              <LucideIcons.Underline className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>下划线</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("code")}
              onPressedChange={() => editor.chain().focus().toggleCode().run()}
              aria-label="行内代码"
              className="text-foreground"
            >
              <LucideIcons.Code className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>行内代码</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive({ textAlign: "left" })}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              aria-label="左对齐"
              className="text-foreground"
            >
              <LucideIcons.AlignLeft className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>左对齐</p>
          </TooltipContent>
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
              className="text-foreground"
            >
              <LucideIcons.AlignCenter className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>居中对齐</p>
          </TooltipContent>
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
              className="text-foreground"
            >
              <LucideIcons.AlignRight className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>右对齐</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().unsetTextAlign().run()
              }
              aria-label="清除格式"
              className="h-8 w-8 p-0 text-foreground"
            >
              <LucideIcons.Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>清除格式</p>
          </TooltipContent>
        </Tooltip>
      </BubbleMenu>
    </TooltipProvider>
  );
}
