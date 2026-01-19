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
      suppressErrorRendering: true, // 防止 mermaid 自动在页面底部插入错误信息
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
        // console.error("Mermaid rendering error:", err);
        setError("语法错误");
      }
    };

    const debounceTimer = setTimeout(() => {
      renderMermaid();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [value, theme]);

  if (error) {
    // 用户要求出错时不显示任何报错 UI，也不要显示原来的文本（或者保持空白，避免界面跳动）
    // 返回 null 或者保留之前的 svg（如果有的话），这里暂时返回 null 保持清净
    return null;
  }

  return (
    <div
      className="mermaid-preview flex justify-center bg-white p-4 rounded-lg border border-border my-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
