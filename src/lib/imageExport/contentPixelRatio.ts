/** 导出长边目标像素（4K 冗余） */
export const EXPORT_TARGET_LONG_EDGE = 3840;
/** 内容清晰度下限倍率（视网膜） */
export const EXPORT_MIN_PIXEL_RATIO = 2;
/** SVG/矢量栅格允许的更高倍率（页面长截图仍走 renderer 的 3×） */
export const EXPORT_MAX_PIXEL_RATIO = 8;

const MAX_CAPTURE_EDGE = 16_384;
const MAX_CAPTURE_PIXELS = 16_000_000;
const MIN_CAPTURE_PIXEL_RATIO = 0.1;

export type ContentAwarePixelRatioOptions = {
  /** 长边目标像素，默认 3840（4K） */
  targetLongEdge?: number;
  /** 最低倍率，默认 2 */
  minRatio?: number;
  /** 最高倍率，默认 8 */
  maxRatio?: number;
};

function isCaptureRatioWithinLimits(
  width: number,
  height: number,
  ratio: number,
): boolean {
  if (ratio < MIN_CAPTURE_PIXEL_RATIO) return false;
  const outputWidth = Math.ceil(width * ratio);
  const outputHeight = Math.ceil(height * ratio);
  return (
    outputWidth <= MAX_CAPTURE_EDGE &&
    outputHeight <= MAX_CAPTURE_EDGE &&
    outputWidth * outputHeight <= MAX_CAPTURE_PIXELS
  );
}

/**
 * 按内容宽高计算导出 pixelRatio：
 * - 优先把长边推到 4K（3840）冗余
 * - 小内容至少 2×，避免糊
 * - 大内容受画布边长 / 16M 像素上限约束
 */
export function calculateContentAwarePixelRatio(
  width: number,
  height: number,
  options?: ContentAwarePixelRatioOptions,
): number {
  const safeWidth = Math.max(1, Math.ceil(width));
  const safeHeight = Math.max(1, Math.ceil(height));
  const longEdge = Math.max(safeWidth, safeHeight);
  const targetLongEdge = options?.targetLongEdge ?? EXPORT_TARGET_LONG_EDGE;
  const minRatio = options?.minRatio ?? EXPORT_MIN_PIXEL_RATIO;
  const maxRatio = options?.maxRatio ?? EXPORT_MAX_PIXEL_RATIO;

  const edgeRatio = Math.min(
    MAX_CAPTURE_EDGE / safeWidth,
    MAX_CAPTURE_EDGE / safeHeight,
  );
  const areaRatio = Math.sqrt(MAX_CAPTURE_PIXELS / (safeWidth * safeHeight));
  // 内容越大倍率可降，但仍尽量贴 4K 长边
  const contentRatio = targetLongEdge / longEdge;
  let ratio = Math.min(maxRatio, edgeRatio, areaRatio, Math.max(minRatio, contentRatio));

  // 若内容本身已超过 4K，仍尽量保留 minRatio（在安全范围内）
  if (longEdge >= targetLongEdge) {
    ratio = Math.min(maxRatio, edgeRatio, areaRatio, Math.max(1, minRatio));
  }

  ratio = Math.floor(ratio * 10_000) / 10_000;

  while (
    ratio >= MIN_CAPTURE_PIXEL_RATIO &&
    !isCaptureRatioWithinLimits(safeWidth, safeHeight, ratio)
  ) {
    ratio = Math.floor((ratio - 0.0001) * 10_000) / 10_000;
  }

  if (!isCaptureRatioWithinLimits(safeWidth, safeHeight, ratio)) {
    throw new Error("内容过大，无法导出为单张图片，请缩小范围后重试");
  }
  return ratio;
}

/** 失败时按更低倍率降级重试（内存/画布偶发失败） */
export function getContentAwarePixelRatios(
  width: number,
  height: number,
  options?: ContentAwarePixelRatioOptions,
): number[] {
  const primary = calculateContentAwarePixelRatio(width, height, options);
  const roundDown = (ratio: number) => Math.floor(ratio * 10_000) / 10_000;
  const candidates =
    primary > 4
      ? [primary, 4, 2, 1]
      : primary > 2
        ? [primary, 2, 1]
        : primary > 1
          ? [primary, 1]
          : [
              primary,
              Math.max(MIN_CAPTURE_PIXEL_RATIO, roundDown(primary * 0.75)),
              Math.max(MIN_CAPTURE_PIXEL_RATIO, roundDown(primary * 0.5)),
            ];

  return candidates.filter(
    (ratio, index) =>
      ratio >= MIN_CAPTURE_PIXEL_RATIO &&
      isCaptureRatioWithinLimits(width, height, ratio) &&
      candidates.findIndex((candidate) => candidate === ratio) === index,
  );
}
