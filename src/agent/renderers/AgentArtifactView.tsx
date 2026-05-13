import React, { useMemo, useRef, type ReactNode } from "react";
import { Info, LoaderCircle } from "lucide-react";
import MarkdownIt from "markdown-it";
import { AiWritePreviewCard } from "@/pages/workspace/components/ai/AiWritePreviewCard";
import type {
  AgentArtifact,
  MarkdownNoteArtifact,
} from "@/agent/core/types";
import type { AiWritePlan } from "@/lib/ai-write";
import { EChartsBlock } from "./EChartsBlock";
import { HtmlWidgetBlock } from "./HtmlWidgetBlock";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { registry } from "./json-render-registry";

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).enable("table");

/**
 * 将 AI 回复文本拆分为普通 markdown 段落和 dataviz 代码块。
 * 支持 ```echarts 和 ```html 两种围栏。
 */
type Segment =
  | { type: "markdown"; content: string }
  | { type: "echarts"; content: string }
  | { type: "html"; content: string }
  | { type: "json-render"; content: string };

const HTML_FRAGMENT_RE =
  /<(div|section|article|main|aside|header|footer|svg|canvas|table|style|script)\b/i;
const STREAMING_HTML_START_RE =
  /<(?:!DOCTYPE\s+html|html|body|div|section|article|main|aside|header|footer|svg|canvas|table|style)\b/i;
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
  const fenceRe = /```(echarts|html|json-render)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "markdown", content: before });
    }
    const lang = match[1] as "echarts" | "html" | "json-render";
    segments.push({ type: lang, content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim();
    if (tail) segments.push({ type: "markdown", content: tail });
  }

  if (segments.length === 1 && segments[0]?.type === "markdown") {
    const mixedHtml = splitStreamingHtmlStart(segments[0].content);
    if (mixedHtml) {
      return [
        ...(mixedHtml.before ? [{ type: "markdown" as const, content: mixedHtml.before }] : []),
        { type: "html" as const, content: mixedHtml.html },
      ];
    }
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

function splitStreamingHtmlStart(text: string) {
  const match = text.match(STREAMING_HTML_START_RE);
  if (!match || match.index === undefined) return null;

  const before = text.slice(0, match.index).trim();
  const html = text.slice(match.index).trim();
  if (!html) return null;

  return { before, html };
}

/** 流式场景：额外检测尾部未闭合的 dataviz 围栏 */
function parseStreamingSegments(text: string, streaming: boolean) {
  const segments: Segment[] = [];
  const fenceRe = /```(echarts|html|json-render)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "markdown", content: before });
    }
    segments.push({
      type: match[1] as "echarts" | "html" | "json-render",
      content: match[2].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  const incompleteRe = /```(echarts|html|json-render)\s*\n([\s\S]*)$/;
  const incompleteMatch = remaining.match(incompleteRe);

  if (incompleteMatch) {
    const before = remaining.slice(0, incompleteMatch.index!).trim();
    if (before) segments.push({ type: "markdown", content: before });
    return {
      segments,
      hasIncompleteBlock: true,
      incompleteBlockType: incompleteMatch[1] as "echarts" | "html" | "json-render",
      incompleteContent: incompleteMatch[2],
    };
  }

  const trimmedRemaining = remaining.trim();
  const streamingHtml = streaming ? splitStreamingHtmlStart(trimmedRemaining) : null;
  if (streamingHtml) {
    if (streamingHtml.before) {
      segments.push({ type: "markdown", content: streamingHtml.before });
    }
    return {
      segments,
      hasIncompleteBlock: true,
      incompleteBlockType: "html" as const,
      incompleteContent: streamingHtml.html,
    };
  }

  if (trimmedRemaining) {
    segments.push({ type: "markdown", content: trimmedRemaining });
  }

  if (!streaming && segments.length === 0 && looksLikeStandaloneHtml(text)) {
    return {
      segments: [{ type: "html", content: text.trim() } satisfies Segment],
      hasIncompleteBlock: false,
      incompleteBlockType: undefined,
      incompleteContent: undefined,
    };
  }

  if (
    !streaming &&
    segments.length === 1 &&
    segments[0]?.type === "markdown" &&
    looksLikeStandaloneHtml(segments[0].content)
  ) {
    return {
      segments: [{ type: "html", content: segments[0].content.trim() } satisfies Segment],
      hasIncompleteBlock: false,
      incompleteBlockType: undefined,
      incompleteContent: undefined,
    };
  }

  return { segments, hasIncompleteBlock: false, incompleteBlockType: undefined, incompleteContent: undefined };
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
    <div className="flex w-full flex-col gap-4">{children}</div>
  );
}

const MarkdownSegmentModule = React.memo(function MarkdownSegmentModule({ content }: { content: string }) {
  return (
    <section
      className="ai-markdown break-words text-sm leading-7"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: md.render(content) }}
    />
  );
});

/** 渲染单个 ECharts dataviz 块，带工具栏 */
const EChartsSegment = React.memo(function EChartsSegment({ content }: { content: string }) {
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
    <section className="relative overflow-visible">
      <EChartsBlock ref={ref} config={config} />
    </section>
  );
});

/** 渲染单个 HTML widget 块 */
const HtmlWidgetSegment = React.memo(function HtmlWidgetSegment({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="relative overflow-visible">
      <HtmlWidgetBlock ref={ref} html={content} />
    </section>
  );
});

/** 流式 HTML widget 块，生成中保持可视化预览 */
const StreamingHtmlWidgetSegment = React.memo(function StreamingHtmlWidgetSegment({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="relative overflow-visible">
      <HtmlWidgetBlock ref={ref} html={content} streaming={true} />
    </section>
  );
});

/** 图表/组件生成中的 loading 占位 — sticky 固定在顶部不随内容移动 */
function DatavizLoadingPlaceholder({ type }: { type: "echarts" | "html" | "json-render" }) {
  const label =
    type === "echarts"
      ? "正在生成图表…"
      : type === "html"
        ? "正在生成交互组件…"
        : "正在生成界面组件…";
  return (
    <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm text-muted-foreground backdrop-blur-sm">
      <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}

/** 渲染单个 json-render UI 块 */
const JsonRenderSegment = React.memo(function JsonRenderSegment({ content }: { content: string }) {
  const spec = useMemo(() => {
    try {
      return JSON.parse(content) as import("@json-render/core").Spec;
    } catch {
      return null;
    }
  }, [content]);

  if (!spec) {
    return (
      <div className="ai-markdown break-words text-sm leading-7">
        <pre><code>{content}</code></pre>
      </div>
    );
  }

  return (
    <section className="relative overflow-visible">
      <JSONUIProvider registry={registry}>
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </section>
  );
});

function segmentKey(seg: Segment, index: number): string {
  return `${seg.type}-${index}`;
}

/** 渲染 dataviz 段落列表（复用于最终态和流式态） */
const DatavizSegmentList = React.memo(function DatavizSegmentList({
  segments,
  trailing,
}: {
  segments: Segment[];
  trailing?: ReactNode;
}) {
  return (
    <DatavizSurface>
      {segments.map((seg, i) => {
        const key = segmentKey(seg, i);
        if (seg.type === "echarts") {
          return <EChartsSegment key={key} content={seg.content} />;
        }
        if (seg.type === "html") {
          return <HtmlWidgetSegment key={key} content={seg.content} />;
        }
        if (seg.type === "json-render") {
          return <JsonRenderSegment key={key} content={seg.content} />;
        }
        return <MarkdownSegmentModule key={key} content={seg.content} />;
      })}
      {trailing}
    </DatavizSurface>
  );
});

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
  const { segments, hasIncompleteBlock, incompleteBlockType, incompleteContent } = useMemo(
    () => parseStreamingSegments(text, streaming),
    [streaming, text],
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

  const standaloneStreamingHtml =
    streaming &&
    !hasIncompleteBlock &&
    segments.length === 1 &&
    segments[0]?.type === "markdown" &&
    looksLikeStandaloneHtml(segments[0].content);

  if (standaloneStreamingHtml) {
    return (
      <div className="break-words text-sm leading-7">
        <DatavizLoadingPlaceholder type="html" />
        <DatavizSurface>
          <StreamingHtmlWidgetSegment content={segments[0].content} />
        </DatavizSurface>
      </div>
    );
  }

  const streamingHtmlTrailing =
    hasIncompleteBlock && incompleteBlockType === "html" && incompleteContent ? (
      <StreamingHtmlWidgetSegment content={incompleteContent} />
    ) : undefined;

  const activeDatavizType =
    incompleteBlockType ??
    [...segments].reverse().find((seg) => seg.type !== "markdown")?.type ??
    "html";
  const leading =
    streaming && (hasIncompleteBlock || hasDataviz) ? (
      <DatavizLoadingPlaceholder type={activeDatavizType} />
    ) : undefined;

  return (
    <div className="break-words text-sm leading-7">
      {leading}
      <DatavizSegmentList
        segments={segments}
        trailing={streamingHtmlTrailing}
      />
      {streaming && !leading && (
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

  const hasDataviz = textHasDataviz(artifact.plan.outputMarkdown);
  if (hasDataviz) {
    const segments = parseDatavizSegments(artifact.plan.outputMarkdown);
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-border/60 dark:border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <Info size={14} />
          <span>包含交互式图表/组件，仅支持在对话中查看</span>
        </div>
        <div className="rounded-b-xl border border-border/60 dark:border-border p-2">
          <DatavizSegmentList segments={segments} />
        </div>
      </div>
    );
  }

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
  if (/```(?:echarts|html|json-render)\s*\n/.test(text)) return true;
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
