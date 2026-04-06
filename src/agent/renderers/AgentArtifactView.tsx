import { useRef, useMemo, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import MarkdownIt from "markdown-it";
import { AiWritePreviewCard } from "@/pages/workspace/components/ai/AiWritePreviewCard";
import type {
  AgentArtifact,
  MarkdownNoteArtifact,
} from "@/agent/core/types";
import type { AiWritePlan } from "@/lib/ai-write";
import { EChartsBlock } from "./EChartsBlock";
import { HtmlWidgetBlock } from "./HtmlWidgetBlock";
import { DatavizToolbar } from "./DatavizToolbar";

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).enable("table");

/**
 * 将 AI 回复文本拆分为普通 markdown 段落和 dataviz 代码块。
 * 支持 ```echarts 和 ```html 两种围栏。
 */
type Segment =
  | { type: "markdown"; content: string }
  | { type: "echarts"; content: string }
  | { type: "html"; content: string };

const HTML_FRAGMENT_RE =
  /<(div|section|article|main|aside|header|footer|svg|canvas|table|style|script)\b/i;
const HTML_CONTROL_ATTR_RE =
  /\b(class|style|onclick|oninput|data-[\w-]+|id)=["'][^"']*["']/i;

function looksLikeStandaloneHtml(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("```")) return false;
  if (!HTML_FRAGMENT_RE.test(trimmed)) return false;
  return (
    HTML_CONTROL_ATTR_RE.test(trimmed) ||
    /<\/(div|section|article|main|aside|header|footer|svg|canvas|table|style|script)>/i.test(trimmed) ||
    /<(script|style)\b/i.test(trimmed)
  );
}

function parseDatavizSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const fenceRe = /```(echarts|html)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "markdown", content: before });
    }
    const lang = match[1] as "echarts" | "html";
    segments.push({ type: lang, content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim();
    if (tail) segments.push({ type: "markdown", content: tail });
  }

  if (segments.length === 0 && looksLikeStandaloneHtml(text)) {
    return [{ type: "html", content: text.trim() }];
  }

  if (
    segments.length === 1 &&
    segments[0]?.type === "markdown" &&
    looksLikeStandaloneHtml(segments[0].content)
  ) {
    return [{ type: "html", content: segments[0].content.trim() }];
  }

  return segments;
}

/** 流式场景：额外检测尾部未闭合的 dataviz 围栏 */
function parseStreamingSegments(text: string) {
  const segments: Segment[] = [];
  const fenceRe = /```(echarts|html)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "markdown", content: before });
    }
    segments.push({ type: match[1] as "echarts" | "html", content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  const incompleteRe = /```(echarts|html)\s*\n([\s\S]*)$/;
  const incompleteMatch = remaining.match(incompleteRe);

  if (incompleteMatch) {
    const before = remaining.slice(0, incompleteMatch.index!).trim();
    if (before) segments.push({ type: "markdown", content: before });
    return {
      segments,
      hasIncompleteBlock: true,
      incompleteBlockType: incompleteMatch[1] as "echarts" | "html",
    };
  }

  if (remaining.trim()) {
    segments.push({ type: "markdown", content: remaining.trim() });
  }

  if (segments.length === 0 && looksLikeStandaloneHtml(text)) {
    return {
      segments: [{ type: "html", content: text.trim() } satisfies Segment],
      hasIncompleteBlock: false,
      incompleteBlockType: undefined,
    };
  }

  if (
    segments.length === 1 &&
    segments[0]?.type === "markdown" &&
    looksLikeStandaloneHtml(segments[0].content)
  ) {
    return {
      segments: [{ type: "html", content: segments[0].content.trim() } satisfies Segment],
      hasIncompleteBlock: false,
      incompleteBlockType: undefined,
    };
  }

  return { segments, hasIncompleteBlock: false, incompleteBlockType: undefined };
}

interface AgentArtifactViewProps {
  artifact: AgentArtifact;
  applying?: boolean;
  onConfirmMarkdownNote?: (artifact: MarkdownNoteArtifact) => void | Promise<void>;
  onCancelMarkdownNote?: (artifact: MarkdownNoteArtifact) => void;
  onOpenResult?: (pageId: string) => void;
}

function DatavizSurface({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">{children}</div>
  );
}

function MarkdownSegmentModule({ content }: { content: string }) {
  return (
    <section
      className="ai-markdown break-words text-sm leading-7 px-1"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: md.render(content) }}
    />
  );
}

/** 渲染单个 ECharts dataviz 块，带工具栏 */
function EChartsSegment({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const config = useMemo(() => {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [content]);

  if (!config) {
    return (
      <div className="ai-markdown break-words text-sm leading-7">
        <pre><code>{content}</code></pre>
      </div>
    );
  }

  return (
    <section className="group relative overflow-visible">
      <EChartsBlock ref={ref} config={config} />
      <DatavizToolbar targetRef={ref} blockType="echarts" />
    </section>
  );
}

/** 渲染单个 HTML widget 块，带工具栏 */
function HtmlWidgetSegment({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="group relative overflow-visible">
      <HtmlWidgetBlock ref={ref} html={content} />
      <DatavizToolbar targetRef={ref} blockType="html" />
    </section>
  );
}

/** 图表/组件生成中的 loading 占位 */
function DatavizLoadingPlaceholder({ type }: { type: "echarts" | "html" }) {
  return (
    <div className="rounded-[1.125rem] border border-border/50 bg-background/60 p-1.5">
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border/30 bg-background/40 p-7">
        <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {type === "echarts" ? "正在生成图表…" : "正在生成交互组件…"}
        </span>
      </div>
    </div>
  );
}

/** 渲染 dataviz 段落列表（复用于最终态和流式态） */
function DatavizSegmentList({
  segments,
  trailing,
}: {
  segments: Segment[];
  trailing?: ReactNode;
}) {
  return (
    <DatavizSurface>
      {segments.map((seg, i) => {
        if (seg.type === "echarts") {
          return <EChartsSegment key={`echarts-${i}`} content={seg.content} />;
        }
        if (seg.type === "html") {
          return <HtmlWidgetSegment key={`html-${i}`} content={seg.content} />;
        }
        return <MarkdownSegmentModule key={`md-${i}`} content={seg.content} />;
      })}
      {trailing}
    </DatavizSurface>
  );
}

/**
 * 流式输出阶段的 dataviz 感知渲染器。
 * 已完成的 echarts/html 块立即渲染为图表，未闭合的块显示 loading。
 */
export function StreamingDatavizText({
  text,
  streaming,
  streamPhaseLabel,
}: {
  text: string;
  streaming: boolean;
  streamPhaseLabel?: string;
}) {
  const { segments, hasIncompleteBlock, incompleteBlockType } = useMemo(
    () => parseStreamingSegments(text),
    [text],
  );

  const hasDataviz = segments.some((s) => s.type !== "markdown") || hasIncompleteBlock;

  // 无 dataviz 内容时保持原始纯文本渲染
  if (!hasDataviz) {
    return (
      <>
        <div className="whitespace-pre-wrap break-words text-sm leading-7">{text}</div>
        {streaming && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "200ms", animationDuration: "1s" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "400ms", animationDuration: "1s" }} />
            {streamPhaseLabel && <span className="ml-1 text-xs text-muted-foreground/70">{streamPhaseLabel}</span>}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="break-words text-sm leading-7">
      <DatavizSegmentList
        segments={segments}
        trailing={
          hasIncompleteBlock && incompleteBlockType ? (
            <DatavizLoadingPlaceholder type={incompleteBlockType} />
          ) : undefined
        }
      />
      {streaming && !hasIncompleteBlock && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "200ms", animationDuration: "1s" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "400ms", animationDuration: "1s" }} />
          {streamPhaseLabel && <span className="ml-1 text-xs text-muted-foreground/70">{streamPhaseLabel}</span>}
        </div>
      )}
    </div>
  );
}

function TextResponseRenderer({ artifact }: { artifact: AgentArtifact }) {
  if (artifact.type !== "text_response") return null;

  const segments = useMemo(() => parseDatavizSegments(artifact.text), [artifact.text]);

  // 无 dataviz 块时走原始 markdown 渲染路径
  if (segments.length === 1 && segments[0].type === "markdown") {
    return (
      <div
        className="ai-markdown break-words text-sm leading-7"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: md.render(artifact.text) }}
      />
    );
  }

  return (
    <div className="break-words text-sm leading-7">
      <DatavizSegmentList segments={segments} />
    </div>
  );
}

function MarkdownNoteRenderer({
  artifact,
  applying = false,
  onConfirmMarkdownNote,
  onCancelMarkdownNote,
  onOpenResult,
}: AgentArtifactViewProps) {
  if (artifact.type !== "markdown_note") return null;
  return (
    <AiWritePreviewCard
      plan={artifact.plan}
      applying={applying}
      onConfirm={(plan: AiWritePlan) => {
        onConfirmMarkdownNote?.({
          type: "markdown_note",
          plan,
        });
      }}
      onCancel={(plan: AiWritePlan) => {
        onCancelMarkdownNote?.({
          type: "markdown_note",
          plan,
        });
      }}
      onOpenResult={onOpenResult}
    />
  );
}

const AGENT_ARTIFACT_RENDERERS = {
  text_response: TextResponseRenderer,
  markdown_note: MarkdownNoteRenderer,
} as const;

/**
 * Returns true when the text contains dataviz fenced blocks (```echarts / ```html)
 * or looks like standalone HTML. Used by the message container to decide
 * whether to strip the default "chat bubble" wrapper.
 */
export function textHasDataviz(text: string | undefined | null): boolean {
  if (!text) return false;
  if (/```(?:echarts|html)\s*\n/.test(text)) return true;
  return looksLikeStandaloneHtml(text);
}

export function artifactHasDataviz(artifact: AgentArtifact | undefined | null): boolean {
  if (!artifact) return false;
  if (artifact.type === "text_response") return textHasDataviz(artifact.text);
  return false;
}

export function AgentArtifactView(props: AgentArtifactViewProps) {
  const Renderer =
    AGENT_ARTIFACT_RENDERERS[
      props.artifact.type as keyof typeof AGENT_ARTIFACT_RENDERERS
    ];
  if (!Renderer) return null;
  return <Renderer {...props} />;
}
