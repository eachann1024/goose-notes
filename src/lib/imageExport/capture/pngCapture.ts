import { toCanvas } from "html-to-image";
import { TEXT_COLORS } from "@/lib/textColors";
import { getElementCapturePixelRatios } from "./pixelRatio";
import { withTimeout } from "./timeout";

const CAPTURE_TIMEOUT_MS = 60_000;

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("图片编码失败"));
        }
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
}

async function yieldForCanvasCleanup(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderPngBlobWithFallback(element: HTMLElement): Promise<Blob> {
  const pixelRatios = getElementCapturePixelRatios(element);
  let lastError: unknown;

  for (let index = 0; index < pixelRatios.length; index += 1) {
    const pixelRatio = pixelRatios[index];
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await withTimeout(
        toCanvas(element, {
          pixelRatio,
          cacheBust: false,
          skipFonts: true,
          imagePlaceholder:
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">' +
                '<rect width="200" height="80" rx="6" fill="#f3f4f6"/>' +
                `<text x="100" y="44" font-family="sans-serif" font-size="13" fill="${TEXT_COLORS.light.secondary}" text-anchor="middle">图片加载失败</text>` +
                "</svg>",
            ),
        }),
        CAPTURE_TIMEOUT_MS,
        "生成图片超时",
      );

      return await withTimeout(
        canvasToPngBlob(canvas),
        CAPTURE_TIMEOUT_MS,
        "图片编码超时",
      );
    } catch (error) {
      lastError = error;
      releaseCanvas(canvas);
      canvas = null;
      const hasFallback = index < pixelRatios.length - 1;
      const timedOut =
        error instanceof Error && /timeout|超时/i.test(error.message);
      // html-to-image 没有取消接口；超时任务可能仍在后台运行，此时再起一次
      // 捕获只会进一步增加内存压力，因此仅对已经明确失败的尝试降级重试。
      if (!hasFallback || timedOut) break;
      console.warn(
        `[imageExport] ${pixelRatio}x capture failed, retrying at ${pixelRatios[index + 1]}x:`,
        error,
      );
      await yieldForCanvasCleanup();
    } finally {
      // PNG Blob 已经独立于画布；每次尝试结束就立即释放大画布，避免在
      // Base64 转换、写盘或下一次降级重试期间继续占用位图内存。
      releaseCanvas(canvas);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("生成图片失败");
}
