import { loadMermaid } from "@/lib/imageExport/loadMermaid";
import {
  getMermaidInitConfig,
  stripMermaidInitDirectives,
} from "@/lib/imageExport/mermaidTheme";
import { tryRenderMermaidTimeline } from "@/lib/imageExport/timelineSvg";

export async function renderMermaidSvgForExport(
  source: string,
  mode: "light" | "dark",
) {
  const timeline = tryRenderMermaidTimeline(source, mode);
  if (timeline) return timeline;

  const mermaid = await loadMermaid();
  mermaid.initialize(
    getMermaidInitConfig({
      mode,
      securityLevel: "strict",
      useMaxWidth: false,
    }),
  );
  const id = `mermaid-native-${crypto.randomUUID()}`;
  const { svg } = await mermaid.render(id, stripMermaidInitDirectives(source));
  return svg;
}
