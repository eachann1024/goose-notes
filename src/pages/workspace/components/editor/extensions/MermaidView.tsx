import React, { useEffect, useState } from "react";
import { useSettings } from "@/stores/useSettings";

interface MermaidViewProps {
  value: string;
}

export const MermaidView: React.FC<MermaidViewProps> = ({ value }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { theme } = useSettings();

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
        setError(null);
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
          suppressErrorRendering: true, // 防止 mermaid 自动在页面底部插入错误信息
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, value);
        if (!active) return;
        setSvg(svg);
        setError(null);
      } catch (err) {
        // console.error("Mermaid rendering error:", err);
        if (active) setError("语法错误");
      }
    };

    debounceTimer = window.setTimeout(() => {
      void renderMermaid();
    }, 500);

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [value, theme]);

  if (error) {
    // 用户要求出错时不显示任何报错 UI，也不要显示原来的文本（或者保持空白，避免界面跳动）
    // 返回 null 或者保留之前的 svg（如果有的话），这里暂时返回 null 保持清净
    return null;
  }

  return (
    <div
      className="mermaid-preview flex justify-center overflow-x-auto bg-transparent"
      style={{ padding: "var(--editor-code-preview-padding)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
