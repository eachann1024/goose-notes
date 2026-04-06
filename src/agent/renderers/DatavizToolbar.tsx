import React, { useCallback, useState } from "react";
import { Copy, Download, Loader2 } from "lucide-react";
import * as echarts from "echarts";
import { toPng } from "html-to-image";
import { toast } from "sonner";

export interface DatavizToolbarProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  blockType: "echarts" | "html";
}

const isUToolsEnv = () =>
  typeof window !== "undefined" && typeof window.utools !== "undefined";

/** 优先用 ECharts 原生 getDataURL，HTML 组件回退到 html-to-image */
async function captureImage(
  el: HTMLDivElement,
  blockType: "echarts" | "html",
): Promise<string> {
  if (blockType === "echarts") {
    const instance = echarts.getInstanceByDom(el);
    if (instance) {
      return instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "transparent" });
    }
  }
  return toPng(el, { pixelRatio: 2 });
}

export const DatavizToolbar: React.FC<DatavizToolbarProps> = React.memo(
  ({ targetRef, blockType }) => {
    const [copyLoading, setCopyLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);

    const handleCopy = useCallback(async () => {
      if (!targetRef.current) return;
      setCopyLoading(true);
      try {
        const dataUrl = await captureImage(targetRef.current, blockType);
        if (isUToolsEnv() && typeof window.utools?.copyImage === "function") {
          window.utools.copyImage(dataUrl);
          toast.success("已复制到剪贴板");
        } else {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          toast.success("已复制到剪贴板");
        }
      } catch (err) {
        toast.error(
          `复制失败: ${err instanceof Error ? err.message : "未知错误"}`,
        );
      } finally {
        setCopyLoading(false);
      }
    }, [targetRef, blockType]);

    const handleDownload = useCallback(async () => {
      if (!targetRef.current) return;
      setDownloadLoading(true);
      try {
        const dataUrl = await captureImage(targetRef.current, blockType);
        if (
          isUToolsEnv() &&
          typeof window.utools?.showSaveDialog === "function" &&
          window.gooseFs?.writeFile
        ) {
          const savePath: string | null = window.utools.showSaveDialog({
            title: "保存图片",
            defaultPath: `chart-${Date.now()}.png`,
            filters: [{ name: "PNG 图片", extensions: ["png"] }],
          });
          if (savePath) {
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            const ok = window.gooseFs.writeFile(savePath, base64, "base64");
            if (ok) {
              toast.success("已保存");
            } else {
              toast.error("保存失败");
            }
          }
        } else {
          const link = document.createElement("a");
          link.download = `chart-${Date.now()}.png`;
          link.href = dataUrl;
          link.click();
          toast.success("已开始下载");
        }
      } catch (err) {
        toast.error(
          `下载失败: ${err instanceof Error ? err.message : "未知错误"}`,
        );
      } finally {
        setDownloadLoading(false);
      }
    }, [targetRef, blockType]);

    return (
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-[9999] pointer-events-none">
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyLoading}
          title="复制为 PNG"
          className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-lg border border-border/50 shadow-sm backdrop-blur-sm transition-colors cursor-pointer bg-background/80 hover:bg-background/95"
        >
          {copyLoading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadLoading}
          title="下载为 PNG"
          className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-lg border border-border/50 shadow-sm backdrop-blur-sm transition-colors cursor-pointer bg-background/80 hover:bg-background/95"
        >
          {downloadLoading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Download size={14} />
          )}
        </button>
      </div>
    );
  },
);

DatavizToolbar.displayName = "DatavizToolbar";
