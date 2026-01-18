import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useOnboardingGuide,
  ONBOARDING_STEPS,
} from "@/stores/useOnboardingGuide";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export function OnboardingOverlay() {
  const { isActive, currentStepIndex, next, prev, skip } = useOnboardingGuide();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const step = ONBOARDING_STEPS[currentStepIndex];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const updateRect = () => {
    if (!isActive) return;
    const element = document.querySelector(step.target);
    if (element) {
      setRect(element.getBoundingClientRect());
    } else {
      setRect(null);
    }
  };

  useEffect(() => {
    if (!isActive) return;

    // 初次渲染和步骤切换时更新位置
    updateRect();

    // 监听窗口大小变化
    window.addEventListener("resize", updateRect);

    // 监听 DOM 变化
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateRect);
      observer.disconnect();
    };
  }, [isActive, currentStepIndex, step?.target]);

  if (!mounted || !isActive || !step) return null;

  const padding = 8;
  const highlightStyle: React.CSSProperties = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : { display: "none" };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* 遮罩层 - 使用 SVG 实现镂空 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto overflow-hidden">
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - padding}
                y={rect.top - padding}
                width={rect.width + padding * 2}
                height={rect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#onboarding-mask)"
          onClick={skip}
        />
      </svg>

      {/* 镂空区域的高亮边框 */}
      {rect && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0)] transition-all duration-300 ease-in-out pointer-events-none animate-in fade-in zoom-in-95"
          style={highlightStyle}
        />
      )}

      {/* 引导气泡 */}
      {rect && (
        <div
          className={cn(
            "absolute pointer-events-auto bg-popover text-popover-foreground rounded-xl shadow-2xl border p-5 w-72 transition-all duration-300 animate-in fade-in slide-in-from-top-2",
            // 根据位置自动调整
            step.position === "right" && "ml-4",
            step.position === "left" && "mr-4",
            step.position === "top" && "mb-4",
            step.position === "bottom" && "mt-4",
          )}
          style={{
            top:
              step.position === "bottom"
                ? rect.bottom + padding
                : step.position === "top"
                  ? rect.top - padding - 200 // 粗略估算
                  : rect.top,
            left:
              step.position === "right"
                ? rect.right + padding
                : step.position === "left"
                  ? rect.left - padding - 288
                  : rect.left + rect.width / 2 - 144, // 居中
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg">{step.title}</h3>
            <button
              onClick={skip}
              className="text-muted-foreground hover:text-foreground"
            >
              <LucideIcons.X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {step.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              {currentStepIndex + 1} / {ONBOARDING_STEPS.length}
            </span>
            <div className="flex gap-2">
              {currentStepIndex > 0 && (
                <Button variant="outline" size="sm" onClick={prev}>
                  上一步
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
                    toast.success("恭喜！你已掌握鹅的笔记核心技巧 ✨");
                    confetti({
                      particleCount: 100,
                      spread: 70,
                      origin: { y: 0.6 },
                      zIndex: 10000,
                    });
                  }
                  next();
                }}
              >
                {currentStepIndex === ONBOARDING_STEPS.length - 1
                  ? "完成"
                  : "下一步"}
              </Button>
            </div>
          </div>

          {/* 气泡小箭头 (简单实现) */}
          <div
            className={cn(
              "absolute w-3 h-3 bg-popover border-l border-t rotate-45",
              step.position === "right" &&
                "-left-1.5 top-8 border-l-border border-t-border",
              step.position === "left" &&
                "-right-1.5 top-8 border-r-border border-b-border rotate-[225deg]",
              step.position === "bottom" &&
                "-top-1.5 left-1/2 -translate-x-1/2 border-l-border border-t-border",
              step.position === "top" &&
                "-bottom-1.5 left-1/2 -translate-x-1/2 border-r-border border-b-border rotate-[225deg]",
            )}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
