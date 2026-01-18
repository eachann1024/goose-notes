import React, { useEffect, useState } from "react";
import mermaid from "mermaid";
import { useSettings } from "@/stores/useSettings";

interface MermaidViewProps {
  value: string;
}

export const MermaidView: React.FC<MermaidViewProps> = ({ value }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { theme } = useSettings();

  useEffect(() => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });

    const renderMermaid = async () => {
      if (!value) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, value);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError("图表语法错误");
      }
    };

    renderMermaid();
  }, [value]);

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive text-xs p-2 rounded border border-destructive/20 my-2 font-mono">
        {error}
      </div>
    );
  }

  return (
    <div
      className="mermaid-preview flex justify-center bg-white p-4 rounded-lg border border-border my-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
