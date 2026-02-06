import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, Download, Copy, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageResizer(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props;
  const resizeRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const previewDescriptionId = useId();

  const isEditable = editor.isEditable;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
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

  // Load image from IndexedDB if src is uuid:...
  useEffect(() => {
    const loadUuidImage = async () => {
      const src = node.attrs.src;

      // 如果是 uuid: 引用，从 IndexedDB 加载
      if (src.startsWith("uuid:")) {
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
        selected ? "ring-2 ring-primary ring-offset-2 rounded-md" : "",
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
        <img
          src={resolvedSrc || node.attrs.src}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className={cn(
            "rounded-md block max-w-full h-auto !m-0",
            !isEditable && "cursor-pointer hover:opacity-90 transition-opacity"
          )}
          style={{ width: width === "auto" ? "auto" : "100%" }}
          onClick={() => !isEditable && setPreviewOpen(true)}
        />

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
                  "w-1 h-8 rounded-full bg-white ring-1 ring-black/30 shadow-sm transition-all group-hover/handle:bg-[#2463EB] group-hover/handle:ring-0",
                  resizing && "bg-[#2463EB] ring-0",
                )}
              />
            </div>

            {/* 预览按钮 - 编辑模式下悬浮显示 */}
            <button
              onClick={() => setPreviewOpen(true)}
              className={cn(
                "absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-md bg-white/96 backdrop-blur-[1px] ring-1 ring-black/10 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:scale-110",
                resizing && "opacity-100",
              )}
              title="预览图片"
            >
              <Maximize2 className="h-4 w-4 text-gray-700" />
            </button>

            <div
              className={cn(
                "absolute top-0 right-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md group/handle z-[9998]",
                resizing && "opacity-100",
              )}
              onMouseDown={(e) => handleMouseDown(e, "right")}
            >
              <div
                className={cn(
                  "w-1 h-8 rounded-full bg-white ring-1 ring-black/30 shadow-sm transition-all group-hover/handle:bg-[#2463EB] group-hover/handle:ring-0",
                  resizing && "bg-[#2463EB] ring-0",
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* Image Preview Dialog - 编辑/只读模式都显示 */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent
            aria-describedby={previewDescriptionId}
            className="max-w-5xl w-[90vw] p-0 bg-transparent border-none shadow-none"
          >
            <DialogTitle className="sr-only">图片预览</DialogTitle>
            <DialogDescription id={previewDescriptionId} className="sr-only">
              预览图片并进行旋转、下载或复制
            </DialogDescription>
            <div className="relative flex flex-col items-center justify-center">
              {/* 关闭按钮 */}
              <button
                onClick={() => setPreviewOpen(false)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* 图片容器 */}
              <div className="relative max-h-[80vh] overflow-hidden rounded-lg bg-black/65 backdrop-blur-[1px]">
                <img
                  src={resolvedSrc || node.attrs.src}
                  alt={node.attrs.alt}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>

              {/* 工具栏 */}
              <div className="mt-4 flex gap-2 bg-black/82 backdrop-blur-[1px] rounded-lg p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="text-white hover:bg-white/20"
                  title="旋转"
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = resolvedSrc || node.attrs.src;
                    a.download = node.attrs.alt || 'image';
                    a.click();
                  }}
                  className="text-white hover:bg-white/20"
                  title="下载"
                >
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      const response = await fetch(node.attrs.src);
                      const blob = await response.blob();
                      await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                      ]);
                    } catch (err) {
                      console.error('Copy failed:', err);
                    }
                  }}
                  className="text-white hover:bg-white/20"
                  title="复制"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
