import type JSZipNs from "jszip";
import { mimeTypeFromAssetPath, getBundledAssetName } from "./assetPaths";
import type { BundledAssetRestorer } from "./types";

export async function loadAssetsFromFolder(
    folder: JSZipNs | null,
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!folder) return map;
    const files: string[] = [];
    folder.forEach((relativePath) => files.push(relativePath));
    for (const p of files) {
      const file = folder.file(p);
      if (file) {
        const base64 = await file.async("base64");
        const mimeType = mimeTypeFromAssetPath(p);
        map.set(p, `data:${mimeType};base64,${base64}`);
      }
    }
    return map;
  }

export function createBundledAssetRestorer(rootAssetMap: Map<string, string>): BundledAssetRestorer {
  const restoreBundledAssets = (
    blocks: any[],
    notebookAssetMap: Map<string, string>,
  ) => {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      if (
        (block.type === "image" ||
          block.type === "imageResize" ||
          block.type === "file" ||
          block.type === "audio" ||
          block.type === "video") &&
        block.props?.url
      ) {
        const src = block.props.url as string;
        const filename = getBundledAssetName(src);
        if (filename) {
          // 优先从笔记本内 assets 查找，再从根级 assets 查找
          const dataUrl =
            notebookAssetMap.get(filename) || rootAssetMap.get(filename);
          if (dataUrl) {
            block.props.url = dataUrl;
          }
        }
      }
      if (block.children?.length)
        restoreBundledAssets(block.children, notebookAssetMap);
    }
  };

  return restoreBundledAssets;
}
