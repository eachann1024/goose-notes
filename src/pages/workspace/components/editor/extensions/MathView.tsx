import React, { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathViewProps {
  value: string;
  displayMode?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({
  value,
  displayMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(value || "\\text{empty}", containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        console.error("KaTeX rendering error:", err);
      }
    }
  }, [value, displayMode]);

  return (
    <span
      ref={containerRef}
      className={displayMode ? "block my-4" : "inline-block px-1"}
    />
  );
};
