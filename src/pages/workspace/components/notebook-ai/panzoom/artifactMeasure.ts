import { readEditorScale } from "../artifactPanZoomScale";
export function editorScaleNow(): number {
  if (typeof document === "undefined") return 1;
  return readEditorScale(
    document.documentElement.style.getPropertyValue("--editor-scale") ||
      getComputedStyle(document.documentElement).getPropertyValue(
        "--editor-scale",
      ),
  );
}

export function roundTransform(value: number) {
  return Math.round(value * 1000) / 1000;
}

function parseSvgLength(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith("%")) return 0;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 量 SVG 固有尺寸。scrollWidth 在旧 Chromium / flex 窄列里常被压成容器宽，
 * 导致 fit 比例=1、再居中 → 左右被 overflow 裁切（用户看到的「遮挡」）。
 */
export function measureArtifactContentSize(content: HTMLElement): {
  width: number;
  height: number;
} {
  const svg = content.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    try {
      const box = svg.getBBox();
      if (box.width > 0 && box.height > 0) {
        const w = Math.ceil(box.width + Math.max(0, box.x));
        const h = Math.ceil(box.height + Math.max(0, box.y));
        if (w > 10 && h > 10) {
          return { width: w, height: h };
        }
      }
    } catch {
      // 未插入布局时 getBBox 会抛错
    }

    const vb = svg.viewBox?.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
      return { width: vb.width, height: vb.height };
    }

    const attrW = parseSvgLength(svg.getAttribute("width"));
    const attrH = parseSvgLength(svg.getAttribute("height"));
    if (attrW > 0 && attrH > 0) {
      return { width: attrW, height: attrH };
    }
  }

  // 临时去掉 transform 再量，避免已缩放时 scrollWidth 失真
  const prevTransform = content.style.transform;
  content.style.transform = "none";
  const width = Math.max(content.scrollWidth, content.offsetWidth, 1);
  const height = Math.max(content.scrollHeight, content.offsetHeight, 1);
  content.style.transform = prevTransform;
  return { width, height };
}
