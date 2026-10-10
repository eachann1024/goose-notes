import { isGeneratedDataImageName } from "@/components/editor/blocks/image/imageCaption";

export function parseFileBlock(lines: string[], startIndex: number) {
  const content: any[] = [];
  let i = startIndex;
  const line = lines[i];
  const trimmedLine = line.trim();
    // 文件附件（旧 serializer 写出的 [📎 name](url) 形式）→ BlockNote file 块
    const fileMatch = trimmedLine.match(/^\[📎\s+([^\]]*)\]\(([^)]*)\)$/);
    if (fileMatch) {
      content.push({
        type: "file",
        props: {
          name: fileMatch[1].trim(),
          url: fileMatch[2],
        },
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

  return null;
}

export function parseImageBlock(lines: string[], startIndex: number) {
  const content: any[] = [];
  let i = startIndex;
  const line = lines[i];
  const trimmedLine = line.trim();
    // 图片：![alt](url){width=N align=X}（width → previewWidth，align → textAlignment）
    const imgMatch = trimmedLine.match(
      /^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/,
    );
    if (imgMatch) {
      const metaRaw = imgMatch[3] || "";
      const metaMap = new Map<string, string>();
      metaRaw
        .split(/\s+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
          const [key, value] = chunk.split("=");
          if (key && value) metaMap.set(key, value);
        });

      const width = metaMap.get("width");
      const widthValue = width ? Number(width) : undefined;
      const align = metaMap.get("align");
      const alt = imgMatch[1];
      const isGeneratedName = isGeneratedDataImageName(alt, imgMatch[2]);
      content.push({
        type: "image",
        props: {
          url: imgMatch[2],
          // Markdown alt 同时供编辑器的 img alt（name）使用。剪贴板生成的
          // image.png 一类默认文件名不应升级为可见 caption；name 仍保留。
          ...(alt ? { name: alt } : {}),
          ...(alt && !isGeneratedName ? { caption: alt } : {}),
          ...(Number.isFinite(widthValue) ? { previewWidth: widthValue } : {}),
          ...(align && align !== "left" ? { textAlignment: align } : {}),
        },
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

  return null;
}
