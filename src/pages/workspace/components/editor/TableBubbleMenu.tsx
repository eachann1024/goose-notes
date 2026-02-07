import { BubbleMenu } from "@tiptap/react/menus";
type TableBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

import { useScrollHide } from "@/hooks/useScrollHide";

export function TableBubbleMenu({ editor, ...props }: TableBubbleMenuProps) {
  const isHidden = useScrollHide(editor);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.zIndex = "20000";
  }, []);

  if (!editor) return null;

  const cellAlign = editor.getAttributes("tableCell").align || "left";
  const iconButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[hsl(var(--goose-selected-bg))] hover:text-foreground";
  const iconDangerButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive";

  return (
    <TooltipProvider>
      <BubbleMenu
        ref={menuRef}
        editor={editor}
        pluginKey="tableBubbleMenu"
        appendTo={() => document.body}
        shouldShow={({ editor }: { editor: any }) => {
          return !isHidden && editor.isEditable && editor.isActive("table");
        }}
        className={cn(
          "z-[20000] flex flex-row items-center gap-0.5 rounded-lg border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] transition-opacity duration-200 max-w-none dark:border-white/20",
          isHidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        {...props}
      >
        {/* 行操作 */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className={iconButtonClass}
            >
              <LucideIcons.ArrowUpToLine className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>在上方插入行</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={iconButtonClass}
            >
              <LucideIcons.ArrowDownToLine className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>在下方插入行</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className={iconDangerButtonClass}
            >
              <LucideIcons.RemoveFormatting className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除行</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* 列操作 */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className={iconButtonClass}
            >
              <LucideIcons.ArrowLeftToLine className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>在左侧插入列</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={iconButtonClass}
            >
              <LucideIcons.ArrowRightToLine className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>在右侧插入列</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className={iconDangerButtonClass}
            >
              <LucideIcons.Columns2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除列</p>
          </TooltipContent>
        </Tooltip>

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
              type="button"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              className={iconButtonClass}
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
              type="button"
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
              className={iconButtonClass}
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
              type="button"
              onClick={() => editor.chain().focus().mergeCells().run()}
              className={iconButtonClass}
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
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className={iconDangerButtonClass}
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
