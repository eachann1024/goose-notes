import { useEffect, useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type AiTiltStyle = CSSProperties & {
  "--ai-tilt-x"?: string;
  "--ai-tilt-y"?: string;
  "--ai-glare-x"?: string;
  "--ai-glare-y"?: string;
};

export function useAiChipTilt(enabled: boolean) {
  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [tiltStyle, setTiltStyle] = useState<AiTiltStyle>({
    "--ai-tilt-x": "0deg",
    "--ai-tilt-y": "0deg",
    "--ai-glare-x": "50%",
    "--ai-glare-y": "50%",
  });
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0, gx: 50, gy: 50 });

  const flushTilt = useCallback(() => {
    frameRef.current = null;
    const { x, y, gx, gy } = targetRef.current;
    setTiltStyle({
      "--ai-tilt-x": `${x.toFixed(2)}deg`,
      "--ai-tilt-y": `${y.toFixed(2)}deg`,
      "--ai-glare-x": `${gx.toFixed(1)}%`,
      "--ai-glare-y": `${gy.toFixed(1)}%`,
    });
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || reduceMotion) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const nx = Math.min(1, Math.max(0, px));
      const ny = Math.min(1, Math.max(0, py));
      // 轻微 3D tilt：像陀螺仪/磁力跟随，而不是整张卡大幅翻转
      targetRef.current = {
        x: (0.5 - ny) * 14,
        y: (nx - 0.5) * 16,
        gx: nx * 100,
        gy: ny * 100,
      };
      if (frameRef.current == null) {
        frameRef.current = window.requestAnimationFrame(flushTilt);
      }
    },
    [enabled, flushTilt, reduceMotion],
  );

  const onPointerLeave = useCallback(() => {
    if (!enabled || reduceMotion) return;
    targetRef.current = { x: 0, y: 0, gx: 50, gy: 50 };
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(flushTilt);
  }, [enabled, flushTilt, reduceMotion]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    tiltStyle: enabled && !reduceMotion ? tiltStyle : undefined,
    onPointerMove: enabled ? onPointerMove : undefined,
    onPointerLeave: enabled ? onPointerLeave : undefined,
  };
}
