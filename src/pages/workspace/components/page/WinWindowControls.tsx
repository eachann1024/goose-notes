/**
 * Windows 自定义窗控（仅 Win frameless 工作区窗）。
 * 放在 DesktopTitleBar 最右侧：最小化 / 最大化·还原 / 关闭。
 */
import { useEffect, useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { cn } from "@/lib/utils";

const btnClass =
  "electron-win-chrome-btn inline-flex h-8 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] ";

export function WinWindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const desktop = getGooseDesktop();
    let cancelled = false;
    void desktop?.isWindowMaximized?.().then((v) => {
      if (!cancelled) setMaximized(Boolean(v));
    });
    const onResize = () => {
      void desktop?.isWindowMaximized?.().then((v) => setMaximized(Boolean(v)));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const desktop = getGooseDesktop();

  return (
    <div
      className="electron-win-chrome-controls ml-1 flex shrink-0 items-stretch self-stretch"
      data-electron-no-drag
      role="group"
      aria-label="窗口控制"
    >
      <button
        type="button"
        className={btnClass}
        aria-label="最小化"
        onClick={() => void desktop?.minimizeWindow?.()}
      >
        <GooseIcons.Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        className={btnClass}
        aria-label={maximized ? "还原" : "最大化"}
        onClick={() => {
          void desktop?.toggleMaximizeWindow?.().then((v) => {
            if (typeof v === "boolean") setMaximized(v);
          });
        }}
      >
        {maximized ? (
          <GooseIcons.Copy className="h-3 w-3 -scale-x-100" strokeWidth={2} />
        ) : (
          <GooseIcons.Square className="h-3 w-3" strokeWidth={2} />
        )}
      </button>
      <button
        type="button"
        className={cn(btnClass, "hover:bg-[#c42b1c] hover:text-white")}
        aria-label="关闭"
        onClick={() => void desktop?.closeWindow?.()}
      >
        <GooseIcons.X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
