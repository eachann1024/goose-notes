import {
  cloneElement,
  isValidElement,
  useContext,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  looksLikeCanvasSource,
  extractSvgMarkup,
} from "@/lib/notebook-ai/canvasSegments";
import { CanvasLoadingCard, SvgArtifactCard } from "../SvgArtifactCard";
import { DiagramCard } from "../DiagramCard";
import { CodeBlock } from "../beautiful-ui/CodeBlock";
import { AssistantToolRenderContext } from "./toolRenderContext";
function languageFromCodeChild(children: ReactNode): string | undefined {
  if (!isValidElement(children)) return undefined;
  const className = (children.props as { className?: string }).className ?? "";
  const match = /(?:^|\s)language-([\w+-]+)/.exec(className);
  return match?.[1];
}

function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  if (isValidElement(node)) {
    return reactNodeToText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** 只包一层 catalog CodeBlock，不替换 Streamdown 高亮。可视化源码走画布卡片。 */
export function MdPre({
  children,
}: ComponentProps<"pre"> & { node?: unknown }) {
  const ctx = useContext(AssistantToolRenderContext);
  const language = languageFromCodeChild(children);
  const source = reactNodeToText(children);
  if (looksLikeCanvasSource(language, source)) {
    const svg = extractSvgMarkup(source);
    if (svg) {
      return <SvgArtifactCard svg={svg} editorRef={ctx?.editorRef} />;
    }
    if (ctx?.isStreaming) return <CanvasLoadingCard />;
    return null;
  }
  // 流式期间沿用 Streamdown：每个 token 都重画 Mermaid 会疯狂闪烁
  if (!ctx?.isStreaming && language?.toLowerCase() === "mermaid") {
    return <DiagramCard source={source} editorRef={ctx?.editorRef} />;
  }
  const marked = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "data-block"?: string }>, {
        "data-block": "true",
      })
    : children;
  return <CodeBlock language={language}>{marked}</CodeBlock>;
}
