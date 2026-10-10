const MAX_CAPTURE_PIXEL_RATIO = 3;
const MIN_CAPTURE_PIXEL_RATIO = 0.1;
const MAX_CAPTURE_EDGE = 16_384;
const MAX_CAPTURE_PIXELS = 16_000_000;

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
 * 按画布边长 / 总像素上限计算可用的 pixelRatio。
 * 理论比值经 floor 到 4 位后，两端 Math.ceil 仍可能略超上限，
 * 因此会继续下调直到落在安全范围内，而不是直接抛「尺寸超出」。
 */
export function calculateSafePixelRatio(width: number, height: number): number {
  const safeWidth = Math.max(1, Math.ceil(width));
  const safeHeight = Math.max(1, Math.ceil(height));
  const edgeRatio = Math.min(
    MAX_CAPTURE_EDGE / safeWidth,
    MAX_CAPTURE_EDGE / safeHeight,
  );
  const areaRatio = Math.sqrt(MAX_CAPTURE_PIXELS / (safeWidth * safeHeight));
  let ratio = Math.min(MAX_CAPTURE_PIXEL_RATIO, edgeRatio, areaRatio);

  // 向下保留四位，避免浮点取整后重新越过安全像素上限。
  ratio = Math.floor(ratio * 10_000) / 10_000;

  // floor 后两端 ceil 仍可能把总像素顶破上限，逐级下调 0.0001。
  while (
    ratio >= MIN_CAPTURE_PIXEL_RATIO &&
    !isCaptureRatioWithinLimits(safeWidth, safeHeight, ratio)
  ) {
    ratio = Math.floor((ratio - 0.0001) * 10_000) / 10_000;
  }

  if (!isCaptureRatioWithinLimits(safeWidth, safeHeight, ratio)) {
    throw new Error("内容过长，无法导出为单张图片，请缩小内容范围后重试");
  }
  return ratio;
}

/**
 * Electron 的 Chromium 运行时连续创建大画布时可能暂时无法分配足够内存。
 * 首次使用安全上限倍率；失败后逐级降到 2x、1x，避免一次偶发的画布失败
 * 直接中断整个导出流程。
 */
export function getCapturePixelRatios(width: number, height: number): number[] {
  const primaryRatio = calculateSafePixelRatio(width, height);
  const roundDown = (ratio: number) => Math.floor(ratio * 10_000) / 10_000;
  const candidates =
    primaryRatio > 2
      ? [primaryRatio, 2, 1]
      : primaryRatio > 1
        ? [primaryRatio, 1]
        : [
            primaryRatio,
            Math.max(MIN_CAPTURE_PIXEL_RATIO, roundDown(primaryRatio * 0.75)),
            Math.max(MIN_CAPTURE_PIXEL_RATIO, roundDown(primaryRatio * 0.5)),
          ];

  return candidates.filter(
    (ratio, index) =>
      ratio >= MIN_CAPTURE_PIXEL_RATIO &&
      candidates.findIndex((candidate) => candidate === ratio) === index,
  );
}

export function getElementCapturePixelRatios(element: HTMLElement): number[] {
  const rect = element.getBoundingClientRect();
  const width = element.scrollWidth || rect.width;
  const height = element.scrollHeight || rect.height;
  return getCapturePixelRatios(width, height);
}
