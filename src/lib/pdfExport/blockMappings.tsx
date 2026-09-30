/**
 * PDF 导出 block mapping。
 *
 * 在项目手写默认映射之上提供自定义 / 视觉块：
 *   - callout      —— 浅色导出：左侧强调色 + 笔记页同色背景 + emoji icon
 *   - file/video/audio —— 可读占位（文件名），不把本地/data URL 丢给 react-pdf 去 fetch
 *   - codeBlock    —— mermaid/math/latex 渲成 PNG；失败才回退源码
 *   - image        —— 任意本地/插件/远程 URL 先转栅格 data URL 再嵌入
 *   - heading      —— 折叠标题加 ▾，子块由 renderer 缩进输出
 */

import type { Text } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { PdfBlockMapping } from "./renderer";
import { resolveCalloutIcon } from "@/components/editor/blocks/callout/calloutIcons";
import {
  isRasterPdfImageSrc,
  resolveCodeBlockVisual,
  resolvePdfImageDataUrl,
  type CodeBlockVisualHooks,
} from "./visualAssets";

const PIXELS_PER_POINT = 0.75;
const FONT_SIZE = 16;

const CALLOUT_BG = "#f7f6f3";
const CALLOUT_BORDER = "#e9e9e7";
const CALLOUT_ACCENT = "#6366f1";

export type PdfBlockMappingOptions = CodeBlockVisualHooks & {
  pageLocalFilePath?: string | null;
  resolveImageSrc?: (
    url: string,
    pageLocalFilePath?: string | null,
  ) => Promise<string | null>;
};

function mediaLabel(block: any, fallback: string): string {
  const name = typeof block?.props?.name === "string" ? block.props.name.trim() : "";
  const caption =
    typeof block?.props?.caption === "string" ? block.props.caption.trim() : "";
  return name || caption || fallback;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** 延迟加载 PDF primitive，不加载编辑器或第三方默认映射。 */
export async function createPdfBlockMappings(options?: PdfBlockMappingOptions) {
  const { View, Text, Link, Image } = await import("@react-pdf/renderer");
  const { createDefaultPdfBlockMappings } = await import("./renderer");
  const defaultBlockMapping = createDefaultPdfBlockMappings();

  const monoFontSize = FONT_SIZE * PIXELS_PER_POINT;
  const pageLocalFilePath = options?.pageLocalFilePath ?? null;
  const resolveImageSrc = options?.resolveImageSrc ?? resolvePdfImageDataUrl;

  const sourceFallback = (
    block: any,
    language: "mermaid" | "math",
    textContent: string,
  ) => {
    const accent = language === "math" ? "#5b8def" : "#7aa874";
    const label = language === "math" ? "ƒ Math" : "📊 Mermaid";
    return (
      <View
        key={language + block.id}
        style={{
          padding: 12 * PIXELS_PER_POINT,
          backgroundColor: "#fafafa",
          borderRadius: 4,
          borderLeftWidth: 3,
          borderLeftColor: accent,
        }}
      >
        <Text style={{ fontSize: monoFontSize * 0.75, color: accent, marginBottom: 4 }}>
          {label}
        </Text>
        <Text style={{ fontSize: monoFontSize }}>{textContent || " "}</Text>
      </View>
    ) as unknown as ReactElement<typeof Text>;
  };

  const pngView = (
    block: any,
    src: string,
    keyPrefix: string,
    caption?: string,
    widthPercent = "100%",
  ) =>
    (
      <View
        wrap={false}
        key={keyPrefix + block.id}
        style={{ alignItems: "center", paddingVertical: 4 * PIXELS_PER_POINT }}
      >
        <Image src={src} style={{ width: widthPercent, maxHeight: 650, objectFit: "contain" }} />
        {caption ? (
          <Text style={{ fontSize: FONT_SIZE * 0.8 * PIXELS_PER_POINT, color: "#6b7280" }}>
            {caption}
          </Text>
        ) : null}
      </View>
    ) as unknown as ReactElement<typeof Text>;

  const placeholderView = (
    block: any,
    keyPrefix: string,
    icon: string,
    label: string,
    url?: string,
  ) => {
    const body = (
      <View
        style={{
          flexDirection: "row",
          gap: 6 * PIXELS_PER_POINT,
          padding: 6 * PIXELS_PER_POINT,
          backgroundColor: "#f5f5f5",
          borderRadius: 4,
        }}
      >
        <Text>{icon}</Text>
        <Text>{label}</Text>
      </View>
    );
    return (
      <View wrap={false} key={keyPrefix + block.id}>
        {url && isHttpUrl(url) ? <Link src={url}>{body}</Link> : body}
      </View>
    ) as unknown as ReactElement<typeof Text>;
  };

  // ----- callout -----
  const calloutMapping = (block: any, exporter: any): ReactElement<typeof Text> => {
    const icon = resolveCalloutIcon(block.props?.icon as string | undefined);
    return (
      <View
        key={"callout" + block.id}
        style={{
          flexDirection: "row",
          gap: 8 * PIXELS_PER_POINT,
          paddingTop: 8 * PIXELS_PER_POINT,
          paddingBottom: 8 * PIXELS_PER_POINT,
          paddingLeft: 12 * PIXELS_PER_POINT,
          paddingRight: 12 * PIXELS_PER_POINT,
          borderLeftWidth: 3,
          borderLeftColor: CALLOUT_ACCENT,
          borderTopWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderTopColor: CALLOUT_BORDER,
          borderRightColor: CALLOUT_BORDER,
          borderBottomColor: CALLOUT_BORDER,
          backgroundColor: CALLOUT_BG,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
        }}
      >
        <Text style={{ marginRight: 4 }}>{icon}</Text>
        <Text style={{ flex: 1 }}>
          {exporter.transformInlineContent(Array.isArray(block.content) ? block.content : [])}
        </Text>
      </View>
    ) as unknown as ReactElement<typeof Text>;
  };

  const fileMapping = (block: any) => {
    const name = mediaLabel(block, "未命名文件");
    const url = String(block.props?.url || "");
    return placeholderView(block, "file", "📎", name, url);
  };

  const videoMapping = (block: any) => {
    const name = mediaLabel(block, "视频");
    const url = String(block.props?.url || "");
    return placeholderView(block, "video", "▶", name, url);
  };

  const audioMapping = (block: any) => {
    const name = mediaLabel(block, "音频");
    const url = String(block.props?.url || "");
    return placeholderView(block, "audio", "♪", name, url);
  };

  const headingMapping = defaultBlockMapping.heading;

  const codeBlockMapping = async (
    block: any,
    exporter: any,
    nestingLevel: number,
    numberedListIndex?: number,
    children?: any,
  ) => {
    const visual = await resolveCodeBlockVisual(block, {
      renderMermaidPng: options?.renderMermaidPng,
      renderMathPng: options?.renderMathPng,
    });

    if (visual.kind === "png") {
      return pngView(
        block,
        visual.src,
        visual.language,
        undefined,
        visual.language === "math" ? "70%" : "100%",
      );
    }
    if (visual.kind === "empty") {
      return (
        <View wrap={false} key={visual.language + block.id} />
      ) as unknown as ReactElement<typeof Text>;
    }
    if (visual.kind === "source-fallback") {
      return sourceFallback(block, visual.language, visual.text);
    }

    return defaultBlockMapping.codeBlock(block, exporter, nestingLevel, numberedListIndex);
  };

  const imageMapping = async (
    block: any,
    exporter: any,
    nestingLevel: number,
    numberedListIndex?: number,
    children?: any,
  ) => {
    const url = String(block?.props?.url || block?.props?.src || "");
    const caption = (block.props?.caption as string) || "";
    let src: string | null = null;
    if (url) {
      try {
        src = await resolveImageSrc(url, pageLocalFilePath);
      } catch (error) {
        console.error("[pdfExport] image resolve failed:", url, error);
        src = null;
      }
    }

    if (src && isRasterPdfImageSrc(src)) {
      return pngView(block, src, "image", caption || undefined);
    }

    return (
      <View wrap={false} key={"image" + block.id} style={{ padding: 6 * PIXELS_PER_POINT }}>
        <Text>{caption || "[图片]"}</Text>
      </View>
    ) as unknown as ReactElement<typeof Text>;
  };

  return {
    ...defaultBlockMapping,
    callout: calloutMapping,
    file: fileMapping,
    video: videoMapping,
    audio: audioMapping,
    heading: headingMapping,
    codeBlock: codeBlockMapping,
    image: imageMapping,
  } as Record<string, PdfBlockMapping>;
}
