import type { RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import { TableCard } from "../TableCard";
import { ChartCard, ChartIncompleteNotice } from "../ChartCard";
import { DiagramCard } from "../DiagramCard";
import { CanvasLoadingCard, SvgArtifactCard } from "../SvgArtifactCard";
import type { ToolDisplayPart } from "../toolProgressVisibility";
export function renderToolVisual(
  part: ToolDisplayPart,
  key: string | number,
  editorRef: RefObject<EditorRef | null> | undefined,
  isStreaming: boolean,
) {
  if (
    part.type === "tool-showTable" &&
    part.state === "output-available" &&
    part.output
  ) {
    const tableData = part.output as {
      title?: string;
      columns: string[];
      rows: string[][];
    };
    return (
      <TableCard
        key={key}
        title={tableData.title}
        columns={tableData.columns}
        rows={tableData.rows}
        editorRef={editorRef}
      />
    );
  }

  if (
    part.type === "tool-showChart" &&
    part.state === "output-available" &&
    part.output
  ) {
    const chartData = part.output as {
      type: "bar" | "line" | "pie";
      title?: string;
      categories?: string[];
      series: Array<{ name: string; data: number[] }>;
    };
    if (!Array.isArray(chartData.series) || chartData.series.length === 0) {
      return <ChartIncompleteNotice key={key} title={chartData.title} />;
    }
    return (
      <ChartCard
        key={key}
        type={chartData.type}
        title={chartData.title}
        categories={chartData.categories}
        series={chartData.series}
        editorRef={editorRef}
      />
    );
  }

  if (
    part.type === "tool-showDiagram" &&
    part.state === "output-available" &&
    part.output
  ) {
    const diagramData = part.output as {
      title?: string;
      language: "mermaid";
      source: string;
    };
    return (
      <DiagramCard
        key={key}
        title={diagramData.title}
        source={diagramData.source}
        editorRef={editorRef}
      />
    );
  }

  if (part.type === "tool-showSvg") {
    if (part.state === "output-available" && part.output) {
      const svgData = part.output as {
        title?: string;
        svg: string;
      };
      return (
        <SvgArtifactCard
          key={key}
          title={svgData.title}
          svg={svgData.svg}
          editorRef={editorRef}
        />
      );
    }
    if (isStreaming && part.state !== "output-error") {
      const input = part.input as { title?: string } | undefined;
      return <CanvasLoadingCard key={key} title={input?.title} />;
    }
  }

  return null;
}
