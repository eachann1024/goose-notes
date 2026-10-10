import type { JSONContent } from "@/types";

// FNV-1a 32 位哈希（含长度），用于按内容给图片附件命名以实现去重。
export function hashBase64(data: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + data.length.toString(36);
}

export function dataUrlImageExtension(subtype: string): string {
  const normalized = subtype.toLowerCase();
  if (normalized === "jpeg") return "jpg";
  if (normalized === "svg+xml") return "svg";
  return normalized.replace(/[^a-z0-9]+/g, "") || "png";
}

export function findImageSourceTarget(node: any): {
  owner: Record<string, unknown>;
  key: "url" | "src";
  value: string;
} | null {
  const props =
    node?.props && typeof node.props === "object" ? node.props : null;
  if (typeof props?.url === "string") {
    return { owner: props, key: "url", value: props.url };
  }
  if (typeof props?.src === "string") {
    return { owner: props, key: "src", value: props.src };
  }

  const attrs =
    node?.attrs && typeof node.attrs === "object" ? node.attrs : null;
  if (typeof attrs?.src === "string") {
    return { owner: attrs, key: "src", value: attrs.src };
  }
  if (typeof attrs?.url === "string") {
    return { owner: attrs, key: "url", value: attrs.url };
  }

  return null;
}

export interface PendingImageWrite {
  imagePath: string;
  base64Data: string;
}

export function collectLocalImageWrites(
  processedContent: JSONContent,
  assetsDir: string,
): PendingImageWrite[] {
  const pendingImageWrites: PendingImageWrite[] = [];
  const processImages = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(processImages);
      return;
    }
    if (!value || typeof value !== "object") return;

    const node = value as any;
    if (
      (node.type === "image" || node.type === "imageResize") &&
      findImageSourceTarget(node)?.value.startsWith("data:image")
    ) {
      const target = findImageSourceTarget(node);
      const match = target?.value.match(
        /^data:(image\/([a-zA-Z0-9.+-]+));base64,(.+)$/,
      );
      if (target && match) {
        const ext = dataUrlImageExtension(match[2]);
        // 按内容哈希命名以去重：相同图片只落盘一次，避免反复保存产生重复文件。
        const base64Data = match[3];
        const filename = `img_${hashBase64(base64Data)}.${ext}`;
        const imagePath = `${assetsDir}/${filename}`;

        let alreadyExists = false;
        try {
          alreadyExists = window.gooseFs?.exists?.(imagePath) ?? false;
        } catch {
          // ignore fs check error
        }

        if (!alreadyExists) {
          pendingImageWrites.push({ imagePath, base64Data });
        }

        target.owner[target.key] = `./assets/${filename}`;
      }
    }

    processImages(node.content);
    processImages(node.children);
    processImages(node.rows);
    processImages(node.cells);
  };

  processImages(processedContent);
  return pendingImageWrites;
}
