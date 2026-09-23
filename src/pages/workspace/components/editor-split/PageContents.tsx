import { useMemo, useRef, useState, type RefObject } from "react";
import { useSettings } from "@/stores/useSettings";
import type { EditorRef } from "@/components/editor/core/Editor";
import { useHeadings, type HeadingItem } from "../outline/useHeadings";
import { getHeadingAnchorElement, useActiveHeading } from "../outline/useActiveHeading";

export function PageContents({ editor, pageId, scrollRef }: {
  editor: EditorRef["editor"];
  pageId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const savedWidth = useSettings(state => state.contentsWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const clamp = (width: number) => Math.min(360, Math.max(128, Number.isFinite(width) ? width : 180));
  const width = clamp(dragWidth ?? savedWidth);
  const headings = useHeadings(editor, pageId);
  const items = useMemo(() => {
    const flatten = (nodes: HeadingItem[]): HeadingItem[] => nodes.flatMap(node => [node, ...flatten(node.children)]);
    return flatten(headings);
  }, [headings]);
  const ids = useMemo(() => items.map(item => item.id), [items]);
  const activeId = useActiveHeading(scrollRef, ids);
  return <nav className="page-contents" aria-label="页内目录" style={{ width }}>
    <div className="page-contents-resizer" role="separator" aria-label="调整目录宽度" aria-orientation="vertical"
      tabIndex={0} aria-valuemin={128} aria-valuemax={360} aria-valuenow={width}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, width }; }}
      onPointerMove={event => { if (drag.current) setDragWidth(clamp(drag.current.width + event.clientX - drag.current.x)); }}
      onPointerUp={event => { if (!drag.current) return; useSettings.setState({ contentsWidth: clamp(drag.current.width + event.clientX - drag.current.x) }); drag.current = null; setDragWidth(null); event.currentTarget.releasePointerCapture(event.pointerId); }}
      onLostPointerCapture={() => { drag.current = null; setDragWidth(null); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        useSettings.setState({ contentsWidth: clamp(event.key === "Home" ? 128 : event.key === "End" ? 360 : width + (event.key === "ArrowRight" ? 16 : -16)) });
      }}
    />
    <div className="page-contents-title">目录</div>
    {items.length === 0 && <p className="text-muted-foreground">添加章节标题后显示目录</p>}
    {items.map(item => <button
      key={item.id}
      type="button"
      aria-current={activeId === item.id ? "location" : undefined}
      style={{ paddingInlineStart: 8 + Math.max(0, item.level - 2) * 10 }}
      title={item.text}
      onClick={() => {
        const container = scrollRef.current;
        if (!container) return;
        const target = getHeadingAnchorElement(container, item.id);
        if (!target) return;
        container.scrollTo({ top: Math.max(0, container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 8), behavior: "smooth" });
      }}
    >{item.text}</button>)}
  </nav>;
}
