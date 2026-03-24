import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Maximize2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export function ImageResizer(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props;
  const resizeRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const isEditable = editor.isEditable;
  const [previewOpen, setPreviewOpen] = useState(false);

  // 预览打开时让编辑器失焦并取消选中，确保图片工具栏（BubbleMenu）隐藏
  useEffect(() => {
    if (previewOpen) {
      // blur 本身不清除 ProseMirror 选区；额外将选区移到位置 0
      // 使 editor.isActive("imageResize") 返回 false，触发 BubbleMenu 的 shouldShow 隐藏
      editor.chain().blur().setTextSelection(0).run();
    }
  }, [previewOpen, editor]);

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
  const systemOpenPath = useMemo(
    () => resolveImageSystemPath(node.attrs.src),
    [node.attrs.src],
  );
  // 远程 http/https 图片也可以用系统浏览器打开
  const isRemoteSrc = useMemo(() => {
    const src = node.attrs.src as string | undefined;
    return Boolean(src && (src.startsWith("http://") || src.startsWith("https://")));
  }, [node.attrs.src]);
  const canOpenInSystem = Boolean(systemOpenPath) || isRemoteSrc;

  const handleSystemOpen = useCallback(async () => {
    // 1. 远程图片 → 用系统默认浏览器/应用打开
    if (isRemoteSrc) {
      UToolsAdapter.openUrl(node.attrs.src as string, false);
      return;
    }

    // 2. 本地文件路径 → 直接用 openPath
    if (systemOpenPath) {
      const opened = await UToolsAdapter.openPath(systemOpenPath);
      if (!opened) UToolsAdapter.showNotification("打开失败：请确认图片文件仍存在");
      return;
    }

    // 3. uuid:/att: 等存储引用 → blob → 临时文件 → openPath
    const src = node.attrs.src as string | undefined;
    if (!src) return;

    if (!window.gooseFs?.writeTempFile) {
      UToolsAdapter.showNotification("当前环境不支持打开图片");
      return;
    }

    try {
      const { imageStorage } = await import("@/lib/imageStorage");
      const blob = await imageStorage.load(src);
      if (!blob) {
        UToolsAdapter.showNotification("图片加载失败");
        return;
      }

      // blob → base64
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i += 0x8000) {
        binary += String.fromCharCode(...uint8.subarray(i, i + 0x8000));
      }
      const base64 = btoa(binary);

      // 写入临时文件
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const tempName = `goose-note/preview/${Date.now()}.${ext}`;
      const tempPath = await window.gooseFs.writeTempFile(tempName, base64);

      if (!tempPath) {
        UToolsAdapter.showNotification("临时文件写入失败");
        return;
      }

      const opened = await UToolsAdapter.openPath(tempPath);
      if (!opened) UToolsAdapter.showNotification("系统默认应用打开失败");
    } catch (err) {
      console.error("[ImageResizer] handleSystemOpen failed:", err);
      UToolsAdapter.showNotification("打开图片时出现错误");
    }
  }, [systemOpenPath, isRemoteSrc, node.attrs.src]);

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

            {/* 预览和系统打开按钮 - 编辑模式下悬浮显示 */}
            <div
              className={cn(
                "absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 z-[10]",
                resizing && "opacity-100",
              )}
            >
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewOpen(true);
                        editor.commands.blur();
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/75 bg-popover text-muted-foreground/70 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] hover:bg-[hsl(var(--goose-selected-bg))] hover:text-foreground dark:border-white/20"
                      aria-label="预览图片"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">预览图片</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleSystemOpen();
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/75 bg-popover text-muted-foreground/70 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] hover:bg-[hsl(var(--goose-selected-bg))] hover:text-foreground dark:border-white/20"
                      aria-label="使用系统默认应用打开"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">使用系统默认应用打开</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

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

      {/* 使用 yet-another-react-lightbox + Zoom 插件：支持鼠标滚轮缩放、按住拖动 */}
      <Lightbox
        open={previewOpen}
        close={() => setPreviewOpen(false)}
        slides={[{ src: resolvedSrc || node.attrs.src }]}
        plugins={[Zoom]}
        zoom={{
          // 最大缩放倍率（像素比），8 倍已足够
          maxZoomPixelRatio: 8,
          // 双击缩放倍率
          zoomInMultiplier: 2,
          // 滚轮缩放灵敏度（越小越平滑）
          wheelZoomDistanceFactor: 100,
          // 开启滚轮缩放（代替滑动）
          scrollToZoom: true,
        }}
        // 隐藏多余导航箭头（单图无需翻页）
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
        }}
        styles={{
          // 背景半透明磨砂风格，与原设计保持一致
          // --yarl__zIndex 必须高于图片工具栏的 z-index(20000)
          root: {
            "--yarl__color_backdrop": "rgba(0,0,0,0.7)",
            "--yarl__zIndex": 30000,
          },
        }}
        carousel={{ finite: true }}
      />
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

function resolveImageSystemPath(src: string | null | undefined): string | null {
  if (!src || typeof src !== "string") return null;
  const normalizedSrc = stripQueryAndHash(src);

  if (
    normalizedSrc.startsWith("data:") ||
    normalizedSrc.startsWith("blob:") ||
    normalizedSrc.startsWith("http://") ||
    normalizedSrc.startsWith("https://") ||
    normalizedSrc.startsWith("uuid:") ||
    normalizedSrc.startsWith("att:")
  ) {
    return null;
  }

  if (normalizedSrc.startsWith("file://")) {
    return decodeFileUrlPath(normalizedSrc);
  }

  if (isAbsolutePath(normalizedSrc)) {
    return normalizedSrc.replace(/\\/g, "/");
  }

  const notebookPath = getCurrentNotebookPath();
  if (!notebookPath) return null;

  if (normalizedSrc.startsWith("./")) {
    return joinNotebookPath(notebookPath, normalizedSrc.slice(2));
  }

  return joinNotebookPath(notebookPath, normalizedSrc);
}

function getCurrentNotebookPath(): string | null {
  const { activePageId, pages } = usePages.getState();
  if (!activePageId) return null;

  const page = pages[activePageId];
  if (!page) return null;

  return useNotebooks.getState().notebooks[page.workspaceId]?.localPath || null;
}

function stripQueryAndHash(src: string): string {
  return src.split(/[?#]/)[0];
}

function decodeFileUrlPath(fileUrl: string): string {
  const rawPath = fileUrl.replace(/^file:\/\//, "");
  const normalizedWindows = rawPath.replace(/^\/([A-Za-z]:[\\/])/, "$1");
  try {
    return decodeURIComponent(normalizedWindows).replace(/\\/g, "/");
  } catch {
    return normalizedWindows.replace(/\\/g, "/");
  }
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function joinNotebookPath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/, "");
  const normalizedRelative = relativePath.replace(/^[\\/]+/, "");
  return `${normalizedBase}/${normalizedRelative}`.replace(/\\/g, "/");
}
