import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { renderMermaidSvgForExport } from "@/lib/imageExport/mermaid";
import type { PreviewContent } from "@/lib/preview/previewAction";
import { isDarkTheme, useCodePreviewActions } from "./useCodePreviewActions";

export function useCodePreview(
  getCodeContent: () => string,
  language: string,
  wrap: boolean,
  theme: string | undefined,
) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewMode, setPreviewMode] = useState<"code" | "preview">("code");
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(
    null,
  );
  const actions = useCodePreviewActions({
    getCodeContent,
    language,
    theme,
    previewRef,
  });
  const handleInternalPreview = useCallback(async () => {
    try {
      const text = getCodeContent().trim();
      if (!text) throw new Error("无可预览内容");

      if (language === "mermaid") {
        const svg = await renderMermaidSvgForExport(
          text,
          isDarkTheme(theme) ? "dark" : "light",
        );
        setPreviewContent({
          kind: "svg",
          markup: svg,
          fileName: "mermaid.svg",
          background: isDarkTheme(theme) ? "#1F1E1C" : "#ffffff",
        });
        return;
      }

      if (language === "math") {
        setPreviewContent({
          kind: "math",
          source: text,
          fileName: "formula.html",
        });
        return;
      }

      throw new Error("当前代码块不支持预览");
    } catch (err) {
      toast.error(
        `预览失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [getCodeContent, language, theme]);

  const textContent = getCodeContent();
  const lineCount = textContent.split("\n").length;
  // yaml-frontmatter 是可编辑的普通代码块，不做表格预览；
  // math/mermaid 才走视觉预览（紧凑编辑器构建退化为可编辑源码）。
  const isMathOrMermaid =
    !__GOOSE_EDITOR_COMPACT__ &&
    (language === "math" || language === "mermaid");
  const isVisualBlock = isMathOrMermaid;
  const canPreview = isMathOrMermaid && textContent.trim().length > 0;
  const shouldShowPreview = canPreview && previewMode === "preview";
  const shouldShowSource =
    !isVisualBlock || previewMode === "code" || !canPreview;
  const showLineNumbers = !isVisualBlock && !wrap;
  const visualTitle = language === "math" ? "Math" : "Mermaid";

  useEffect(() => {
    // yaml-frontmatter 是普通可编辑代码块，不支持预览，永远是源码态。
    // 仅 math/mermaid 这类以渲染图为主的块自动切到预览。
    if (!isVisualBlock) {
      setPreviewMode("code");
      setPreviewContent(null);
      return;
    }
    if (!canPreview) {
      setPreviewMode("code");
      setPreviewContent(null);
      return;
    }
    setPreviewMode((current) => (current === "code" ? "preview" : current));
  }, [isVisualBlock, canPreview]);

  return {
    ...actions,
    previewRef,
    previewMode,
    setPreviewMode,
    previewContent,
    setPreviewContent,
    handleInternalPreview,
    textContent,
    lineCount,
    isVisualBlock,
    canPreview,
    shouldShowPreview,
    shouldShowSource,
    showLineNumbers,
    visualTitle,
  };
}
