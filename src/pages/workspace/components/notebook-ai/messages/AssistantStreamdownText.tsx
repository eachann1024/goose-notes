import { memo, useMemo, type RefObject } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import type { EditorRef } from "@/components/editor/core/Editor";
import { parseCanvasAwareSegments } from "@/lib/notebook-ai/canvasSegments";
import { useSettings } from "@/stores/useSettings";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { getMermaidInitConfig } from "@/lib/imageExport/mermaidTheme";
import { CanvasLoadingCard, SvgArtifactCard } from "../SvgArtifactCard";
import { StreamingText } from "../beautiful-ui/StreamingText";
import { MdInput, MdTable, MdThead, MdTr, MdTh, MdTd } from "./MarkdownTable";
import { MdPre } from "./MarkdownCode";
const MD_COMPONENTS = {
  input: MdInput,
  table: MdTable,
  thead: MdThead,
  tr: MdTr,
  th: MdTh,
  td: MdTd,
  pre: MdPre,
};

/**
 * 关掉 Streamdown 表格工具条，避免默认 wrapper/utility 依赖。
 * mermaid 只在流式期间由 Streamdown 渲染，生成完即换成 DiagramCard，
 * 这段过渡态不需要任何控件。
 */
const STREAMDOWN_CONTROLS = {
  table: false,
  code: true,
  mermaid: false,
} as const;

/** 模块级稳定引用：禁止 plugins={{ cjk }} 内联，避免 Streamdown 每帧当新插件树 */
const STREAMDOWN_PLUGINS = { cjk };

const STREAMDOWN_MERMAID_LIGHT = {
  config: getMermaidInitConfig({
    mode: "light",
    securityLevel: "loose",
    useMaxWidth: true,
  }),
} as const;

const STREAMDOWN_MERMAID_DARK = {
  config: getMermaidInitConfig({
    mode: "dark",
    securityLevel: "loose",
    useMaxWidth: true,
  }),
} as const;

/**
 * 助手正文：模块级 memo，禁止在 renderAssistantMessage 内定义 TextPart，
 * 否则每次父渲染新组件 identity → 卸载/重挂 Streamdown → 流式极卡。
 */
export const AssistantStreamdownText = memo(function AssistantStreamdownText({
  text,
  isStreaming,
  editorRef,
}: {
  text: string;
  isStreaming: boolean;
  editorRef?: RefObject<EditorRef | null>;
}) {
  const theme = useSettings((state) => state.theme);
  const resolvedTheme = useResolvedTheme(theme);
  const mermaid =
    resolvedTheme === "dark"
      ? STREAMDOWN_MERMAID_DARK
      : STREAMDOWN_MERMAID_LIGHT;
  const segments = useMemo(
    () => parseCanvasAwareSegments(text, isStreaming),
    [isStreaming, text],
  );
  const hasCanvas = segments.some(
    (segment) => segment.type === "svg" || segment.type === "pending",
  );

  if (!text?.trim()) return null;

  return (
    <StreamingText streaming={isStreaming}>
      <div className="ai-md notebook-ai-message-text min-w-0 max-w-full select-text text-sm text-foreground">
        {hasCanvas ? (
          <div className="min-w-0 max-w-full space-y-[12px]">
            {segments.map((segment, index) => {
              if (segment.type === "pending") {
                return <CanvasLoadingCard key={`canvas-pending-${index}`} />;
              }
              if (segment.type === "svg") {
                return (
                  <SvgArtifactCard
                    key={`canvas-svg-${index}`}
                    svg={segment.content}
                    editorRef={editorRef}
                  />
                );
              }
              return (
                <Streamdown
                  key={`canvas-md-${index}`}
                  className="min-w-0 max-w-full space-y-[12px]"
                  mode={isStreaming ? "streaming" : "static"}
                  components={MD_COMPONENTS}
                  plugins={STREAMDOWN_PLUGINS}
                  controls={STREAMDOWN_CONTROLS}
                  mermaid={mermaid}
                  parseIncompleteMarkdown={
                    isStreaming && index === segments.length - 1
                  }
                >
                  {segment.content}
                </Streamdown>
              );
            })}
          </div>
        ) : (
          <Streamdown
            className="min-w-0 max-w-full space-y-[12px]"
            mode={isStreaming ? "streaming" : "static"}
            components={MD_COMPONENTS}
            plugins={STREAMDOWN_PLUGINS}
            controls={STREAMDOWN_CONTROLS}
            mermaid={mermaid}
            parseIncompleteMarkdown={isStreaming}
          >
            {text}
          </Streamdown>
        )}
      </div>
    </StreamingText>
  );
});
