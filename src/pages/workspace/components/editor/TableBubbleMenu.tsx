import { BubbleMenu } from "@tiptap/react/menus";
type TableBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

export function TableBubbleMenu({ editor, ...props }: TableBubbleMenuProps) {
  if (!editor) return null;

  const cellAlign = editor.getAttributes("tableCell").align || "left";

  return (
    <TooltipProvider>
      <BubbleMenu
        editor={editor}
        pluginKey="tableBubbleMenu"
        shouldShow={({ editor }: { editor: any }) => {
          return editor.isActive("table");
        }}
        className="flex flex-row items-start gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md !z-50"
        // @ts-ignore
        tippyOptions={{
          zIndex: 9999,
          maxWidth: "none",
          appendTo: () => document.body,
        }}
        {...props}
      >


        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={cellAlign === "left"}
              onPressedChange={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("tableCell", { align: "left" })
                  .run()
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
              pressed={cellAlign === "center"}
              onPressedChange={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("tableCell", { align: "center" })
                  .run()
              }
              aria-label="居中"
              className="text-foreground"
            >
              <LucideIcons.AlignCenter className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>居中</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={cellAlign === "right"}
              onPressedChange={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("tableCell", { align: "right" })
                  .run()
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

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
            >
              <LucideIcons.Heading className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>表头行</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
            >
              <LucideIcons.ArrowRight className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>表头列</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.chain().focus().mergeCells().run()}
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
            >
              <LucideIcons.Merge className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>合并单元格</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
            >
              <LucideIcons.Trash2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除表格</p>
          </TooltipContent>
        </Tooltip>
      </BubbleMenu>
    </TooltipProvider>
  );
}
