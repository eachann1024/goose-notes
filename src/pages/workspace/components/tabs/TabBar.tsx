import { useCallback, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UToolsAdapter } from "@/lib/utools";
import { useTabs } from "@/stores/useTabs";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/lib/page-title";

const isTauriMac =
  UToolsAdapter.isTauri &&
  typeof window !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(window.navigator.platform || "");

function TabItem({
  pageId,
  isActive,
  onClose,
  onClick,
}: {
  pageId: string;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}) {
  const page = usePages((s) => s.pages[pageId]);
  if (!page) return null;

  const title = getPageTitle(page);
  const iconName = page.icon;
  const iconComponentMap = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = iconName ? iconComponentMap[iconName] : null;

  const handleMouseDown = (e: React.MouseEvent) => {
    // 阻止冒泡到拖拽区域
    e.stopPropagation();
    // 鼠标中键点击关闭
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={cn(
        "tab-bar-item group",
        isActive && "tab-bar-item-active",
      )}
      onClick={onClick}
      onMouseDown={handleMouseDown}
    >
      <span className="tab-bar-item-icon">
        {iconName ? (
          IconComponent ? (
            <IconComponent className="h-3.5 w-3.5" />
          ) : (
            <span className="text-xs leading-none">{iconName}</span>
          )
        ) : (
          <LucideIcons.FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
      </span>
      <span className="tab-bar-item-title">{title || "无标题"}</span>
      <button
        type="button"
        className="tab-bar-item-close"
        onClick={handleCloseClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <LucideIcons.X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TabBar() {
  if (!isTauriMac) return null;

  const { openTabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新标签打开时自动滚动到可见区域
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const container = scrollRef.current;
    const activeEl = container.querySelector(
      `[data-tab-id="${activeTabId}"]`,
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId, openTabs.length]);

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 仅当点击的是容器本身（空白区域）时启动窗口拖拽
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(".tab-bar-item")) return;

      void (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().startDragging();
        } catch {
          // fallback to native drag-region
        }
      })();
    },
    [],
  );

  return (
    <div
      data-tauri-drag-region
      className="tauri-mac-title-drag-region"
      aria-hidden="true"
      onMouseDown={handleContainerMouseDown}
    >
      <div ref={scrollRef} className="tab-bar-inner">
        {openTabs.map((pageId) => (
          <div key={pageId} data-tab-id={pageId}>
            <TabItem
              pageId={pageId}
              isActive={activeTabId === pageId}
              onClick={() => setActiveTab(pageId)}
              onClose={() => closeTab(pageId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
