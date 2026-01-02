import { BubbleMenu } from "@tiptap/react/menus";
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

          // 图片、表格、NodeSelection 时不显示
          if (
            editor.isActive("image") ||
            editor.isActive("table") ||
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
      </BubbleMenu>
    </TooltipProvider>
  );
}
