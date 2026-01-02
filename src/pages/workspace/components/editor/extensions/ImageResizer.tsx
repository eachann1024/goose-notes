import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function ImageResizer(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props;
  const resizeRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const isEditable = editor.isEditable;

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
          src={node.attrs.src}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className="rounded-md block max-w-full h-auto !m-0"
          style={{ width: width === "auto" ? "auto" : "100%" }}
        />

        {/* Resize Handle - visible only on hover or selection */}
        {isEditable && (
          <>
            <div
              className={cn(
                "absolute top-0 left-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md group/handle",
                resizing && "opacity-100",
              )}
              onMouseDown={(e) => handleMouseDown(e, "left")}
            >
              <div
                className={cn(
                  "w-1 h-8 rounded-full bg-black/20 transition-colors group-hover/handle:bg-[#2463EB]",
                  resizing && "bg-[#2463EB]",
                )}
              />
            </div>
            <div
              className={cn(
                "absolute top-0 right-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md group/handle",
                resizing && "opacity-100",
              )}
              onMouseDown={(e) => handleMouseDown(e, "right")}
            >
              <div
                className={cn(
                  "w-1 h-8 rounded-full bg-black/20 transition-colors group-hover/handle:bg-[#2463EB]",
                  resizing && "bg-[#2463EB]",
                )}
              />
            </div>
          </>
        )}
      </div>
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
