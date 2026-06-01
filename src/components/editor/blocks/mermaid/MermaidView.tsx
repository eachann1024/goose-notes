import { useEffect, useState } from "react";
import { useEditorSettings } from "@/components/editor/platform/hostContext";

interface MermaidViewProps {
  value: string;
}

export const MermaidView: React.FC<MermaidViewProps> = ({ value }) => {
  const [svg, setSvg] = useState<string>("");
  const { theme } = useEditorSettings();

  useEffect(() => {
    let active = true;
    let debounceTimer: number | undefined;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    const renderMermaid = async () => {
      if (!value) {
        setSvg("");
        return;
      }
      try {
        const { default: mermaid } = await import("mermaid");
        if (!active) return;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, value);
        if (!active) return;
        setSvg(svg);
      } catch {
        if (active) setSvg("");
      }
    };

    debounceTimer = window.setTimeout(() => { void renderMermaid(); }, 500);
    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [value, theme]);

  if (!svg) return null;

  return (
    <div
      className="mermaid-preview flex justify-center overflow-x-auto bg-transparent"
      style={{ padding: "var(--editor-code-preview-padding, 16px)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
