import React, { useEffect, useRef } from "react";

interface MathViewProps {
  value: string;
  displayMode?: boolean;
}

let katexPromise: Promise<{ default: any }> | null = null;

const getKatex = async () => {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import("katex"),
      import("katex/dist/katex.min.css"),
    ]).then(([katexModule]) => katexModule);
  }
  return katexPromise;
};

export const MathView: React.FC<MathViewProps> = ({
  value,
  displayMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const renderMath = async () => {
      if (!containerRef.current) return;
      try {
        const { default: katex } = await getKatex();
        if (!containerRef.current || !active) return;
        katex.render(value || "\\text{empty}", containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        console.error("KaTeX rendering error:", err);
      }
    };
    void renderMath();
    return () => {
      active = false;
    };
  }, [value, displayMode]);

  return (
    <span
      ref={containerRef}
      className={displayMode ? "block" : "inline-block"}
      style={
        displayMode
          ? { margin: "calc(16px * var(--editor-scale)) 0" }
          : { padding: `0 calc(4px * var(--editor-scale))` }
      }
    />
  );
};
