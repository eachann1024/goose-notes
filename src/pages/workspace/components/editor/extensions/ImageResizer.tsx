import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { createPortal } from "react-dom";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageResizer(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props;
  const resizeRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const isEditable = editor.isEditable;
  const [previewOpen, setPreviewOpen] = useState(false);

  // ESC 关闭预览
  useEffect(() => {
    if (!previewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const parseWidthFromStyle = useCallback(
    (style: string | null | undefined) => {
      if (!style) return null;
      const match = style.match(/width:\s*([0-9.]+)px/);
      return match ? Number(match[1]) : null;
    },
    [],
  );

  const parseMarginFromStyle = useCallback(
    (style: string | null | undefined) => {
      if (!style) return undefined;
      const match = style.match(/margin:\s*([^;]+);?/);
      return match ? match[1].trim() : undefined;
    },
    [],
  );

  const [width, setWidth] = useState<number | "auto">(
    node.attrs.width ??
      parseWidthFromStyle(node.attrs.containerStyle) ??
      "auto",
  );

  // Update local state when node attributes change externally
  useEffect(() => {
    setWidth(
      node.attrs.width ??
        parseWidthFromStyle(node.attrs.containerStyle) ??
        "auto",
    );
  }, [node.attrs.width, node.attrs.containerStyle, parseWidthFromStyle]);

  // Load image from storage if src is uuid: or att:...
  useEffect(() => {
    const loadUuidImage = async () => {
      const src = node.attrs.src;

      // 如果是 uuid: 或 att: 引用，从存储加载
      if (src.startsWith("uuid:") || src.startsWith("att:")) {
        try {
          const { imageStorage } = await import("@/lib/imageStorage");
          const blob = await imageStorage.load(src);
          if (blob) {
            const url = URL.createObjectURL(blob);
            setResolvedSrc(url);
            setBlobUrl(url); // 保存用于清理
          } else {
            setResolvedSrc(src); // fallback
          }
        } catch (err) {
          console.error("Failed to load image from storage:", err);
          setResolvedSrc(src);
        }
      } else {
        setResolvedSrc(src);
      }
    };

    loadUuidImage();

    // 清理函数：组件卸载时释放 blob URL
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [node.attrs.src]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "left" | "right") => {
      if (!isEditable) return;
      e.preventDefault();
      setResizing(true);

      const startX = e.clientX;
      const startW = resizeRef.current?.offsetWidth || 0;
      const multiplier = direction === "left" ? -1 : 1;

      const getMaxWidth = () =>
        resizeRef.current?.parentElement?.clientWidth || Infinity;

      const onMouseMove = (e: MouseEvent) => {
        const currentX = e.clientX;
        const diffX = (currentX - startX) * multiplier;
        const maxW = getMaxWidth();
        const newWidth = Math.min(maxW, Math.max(100, startW + diffX));

        setWidth(newWidth);
      };

      const onMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        setResizing(false);

        const currentX = e.clientX;
        const diffX = (currentX - startX) * multiplier;
        const maxW = getMaxWidth();
        const newWidth = Math.min(maxW, Math.max(100, startW + diffX));
        const nextStyle = upsertWidthStyle(node.attrs.containerStyle, newWidth);

        updateAttributes({ width: newWidth, containerStyle: nextStyle });

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [node.attrs.containerStyle, updateAttributes],
  );

  const margin = useMemo(
    () => parseMarginFromStyle(node.attrs.containerStyle),
    [node.attrs.containerStyle, parseMarginFromStyle],
  );

  return (
    <NodeViewWrapper
      className={cn(
        "image-node relative block w-full group transition-all",
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-md dark:ring-blue-400"
          : "",
      )}
    >
      <div
        ref={resizeRef}
        className="relative block max-w-full"
        style={{
          width: width === "auto" ? "fit-content" : `${width}px`,
          maxWidth: "100%",
          margin,
        }}
      >
        {node.attrs.title ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src={resolvedSrc || node.attrs.src}
                  alt={node.attrs.alt}
                  className={cn(
                    "rounded-md block max-w-full h-auto !m-0",
                    !isEditable && "cursor-pointer hover:opacity-90 transition-opacity"
                  )}
                  style={{ width: width === "auto" ? "auto" : "100%" }}
                  onClick={() => !isEditable && setPreviewOpen(true)}
                />
              </TooltipTrigger>
              <TooltipContent side="top">{node.attrs.title}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <img
            src={resolvedSrc || node.attrs.src}
            alt={node.attrs.alt}
            className={cn(
              "rounded-md block max-w-full h-auto !m-0",
              !isEditable && "cursor-pointer hover:opacity-90 transition-opacity"
            )}
            style={{ width: width === "auto" ? "auto" : "100%" }}
            onClick={() => !isEditable && setPreviewOpen(true)}
          />
        )}

        {/* Resize Handle & Preview Button - visible only on hover or selection */}
        {isEditable && (
          <>
            <div
              className={cn(
                "absolute top-0 left-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md group/handle z-[9998]",
                resizing && "opacity-100",
              )}
              onMouseDown={(e) => handleMouseDown(e, "left")}
            >
              <div
                className={cn(
                  "w-1 h-8 rounded-full bg-white ring-1 ring-black/30 shadow-sm transition-all group-hover/handle:bg-[#2463EB] group-hover/handle:ring-0 dark:bg-slate-300 dark:ring-slate-900/65 dark:group-hover/handle:bg-blue-400",
                  resizing && "bg-[#2463EB] ring-0 dark:bg-blue-400",
                )}
              />
            </div>

            {/* 预览按钮 - 编辑模式下悬浮显示 */}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewOpen(true);
                      editor.commands.blur();
                    }}
                    className={cn(
                      "absolute top-2 left-1/2 -translate-x-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/75 bg-popover text-muted-foreground/70 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] opacity-0 transition-all hover:bg-[hsl(var(--goose-selected-bg))] hover:text-foreground group-hover:opacity-100 dark:border-white/20",
                      resizing && "opacity-100",
                    )}
                    aria-label="预览图片"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">预览图片</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div
              className={cn(
                "absolute top-0 right-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md group/handle z-[9998]",
                resizing && "opacity-100",
              )}
              onMouseDown={(e) => handleMouseDown(e, "right")}
            >
              <div
                className={cn(
                  "w-1 h-8 rounded-full bg-white ring-1 ring-black/30 shadow-sm transition-all group-hover/handle:bg-[#2463EB] group-hover/handle:ring-0 dark:bg-slate-300 dark:ring-slate-900/65 dark:group-hover/handle:bg-blue-400",
                  resizing && "bg-[#2463EB] ring-0 dark:bg-blue-400",
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* Image Preview - 编辑/只读模式都显示 */}
      {previewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[20001] flex items-center justify-center bg-black/30 backdrop-blur-[1px] animate-in fade-in-0 duration-200"
            onClick={() => setPreviewOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
          >
            <div
              className="relative max-w-5xl w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="absolute -top-10 right-0 text-white transition-colors hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>

              {/* 图片容器 */}
              <div className="max-h-[80vh] overflow-hidden rounded-lg bg-black/70 backdrop-blur-[1px]">
                <img
                  src={resolvedSrc || node.attrs.src}
                  alt={node.attrs.alt}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
}

function upsertWidthStyle(
  style: string | null | undefined,
  width: number,
): string {
  const next = (style || "").trim();
  const widthRule = `width: ${width}px;`;

  if (!next) return widthRule;
  if (next.match(/width:\s*[0-9.]+px/)) {
    return next.replace(/width:\s*[0-9.]+px;?/, widthRule);
  }
  return `${next} ${widthRule}`.trim();
}
