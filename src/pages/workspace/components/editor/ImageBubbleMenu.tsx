import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";

type ImageBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

// 辅助函数：根据当前对齐状态判断 pressed
function getAlignFromStyle(
  style: string | null | undefined,
): "left" | "center" | "right" {
  if (!style) return "left";
  if (
    style.includes("margin: 0 0 0 auto") ||
    style.includes("margin: 0px 0px 0px auto")
  )
    return "right";
  if (
    style.includes("margin: 0 auto 0 0") ||
    style.includes("margin: 0px auto 0px 0px")
  )
    return "left";
  if (style.includes("margin: 0 auto;") || style.includes("margin: 0px auto"))
    return "center";
  return "left";
}

// 辅助函数：生成新的 containerStyle
function setAlignStyle(
  currentStyle: string | null | undefined,
  align: "left" | "center" | "right",
): string {
  // 移除已有的 margin 样式
  const baseStyle = (currentStyle || "").replace(/margin:[^;]*;?/g, "").trim();
  const marginMap = {
    left: "margin: 0 auto 0 0;",
    center: "margin: 0 auto;",
    right: "margin: 0 0 0 auto;",
  };
  return `${baseStyle} ${marginMap[align]}`.trim();
}

export function ImageBubbleMenu({ editor, ...props }: ImageBubbleMenuProps) {
  if (!editor) return null;

  const currentAlign = useEditorState({
    editor,
    selector: (ctx) => {
      const attrs = ctx.editor.getAttributes("imageResize");
      return getAlignFromStyle(attrs?.containerStyle);
    },
  });

  const handleAlign = (align: "left" | "center" | "right") => {
    if (!editor.isActive("imageResize")) return;
    const attrs = editor.getAttributes("imageResize");
    const newStyle = setAlignStyle(attrs?.containerStyle, align);
    editor
      .chain()
      .focus()
      .updateAttributes("imageResize", { containerStyle: newStyle })
      .run();
  };

  return (
    <TooltipProvider>
      <BubbleMenu
        editor={editor}
        className="flex items-center space-x-1 rounded-md border border-border bg-popover p-1 shadow-md backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150"
        shouldShow={({ editor }: { editor: Editor }) => {
          return editor.isEditable && editor.isActive("imageResize");
        }}
        {...props}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={currentAlign === "left"}
              onPressedChange={() => handleAlign("left")}
              aria-label="左对齐"
              className={cn(
                "text-foreground",
                currentAlign === "left" && "bg-primary/20 text-primary",
              )}
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
              pressed={currentAlign === "center"}
              onPressedChange={() => handleAlign("center")}
              aria-label="居中"
              className={cn(
                "text-foreground",
                currentAlign === "center" && "bg-primary/20 text-primary",
              )}
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
              pressed={currentAlign === "right"}
              onPressedChange={() => handleAlign("right")}
              aria-label="右对齐"
              className={cn(
                "text-foreground",
                currentAlign === "right" && "bg-primary/20 text-primary",
              )}
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
              onClick={() => editor.chain().focus().deleteSelection().run()}
              className="h-8 px-2 text-destructive hover:text-destructive"
            >
              <LucideIcons.Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除图片</p>
          </TooltipContent>
        </Tooltip>
      </BubbleMenu>
    </TooltipProvider>
  );
}
