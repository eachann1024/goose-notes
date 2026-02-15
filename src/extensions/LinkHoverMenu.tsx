import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";

interface LinkHoverMenuProps {
  editor: Editor;
}

export function LinkHoverMenu({ editor }: LinkHoverMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [linkElement, setLinkElement] = useState<HTMLAnchorElement | null>(
    null,
  );
  const [editUrl, setEditUrl] = useState("");
  const [editText, setEditText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setIsEditing(false);
      setLinkElement(null);
    }, 150);
  }, [clearHideTimeout]);

  const handleMouseEnterLink = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a[href]") as HTMLAnchorElement | null;

    if (!link || !link.closest(".ProseMirror")) return;

    clearHideTimeout();

    const rect = link.getBoundingClientRect();
    setPosition({
      x: rect.left,
      y: rect.bottom + 6,
    });
    setLinkElement(link);
    setIsVisible(true);
    setIsEditing(false);
  }, [clearHideTimeout]);

  const handleMouseLeaveLink = useCallback((e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest("[data-link-hover-menu]")) return;
    scheduleHide();
  }, [scheduleHide]);

  const handleMenuMouseEnter = () => {
    clearHideTimeout();
  };

  const handleMenuMouseLeave = () => {
    if (!isEditing) {
      scheduleHide();
    }
  };

  useEffect(() => {
    const editorDom = editor.view.dom;
    editorDom.addEventListener("mouseover", handleMouseEnterLink);
    editorDom.addEventListener("mouseout", handleMouseLeaveLink);

    return () => {
      editorDom.removeEventListener("mouseover", handleMouseEnterLink);
      editorDom.removeEventListener("mouseout", handleMouseLeaveLink);
      clearHideTimeout();
    };
  }, [editor, handleMouseEnterLink, handleMouseLeaveLink, clearHideTimeout]);

  useEffect(() => {
    return subscribeGlobalScrollActivity((nextSnapshot) => {
      if (!nextSnapshot.isScrolling) return;
      setIsVisible((prev) => (prev ? false : prev));
      setIsEditing((prev) => (prev ? false : prev));
      setLinkElement((prev) => (prev ? null : prev));
    });
  }, []);

  useEffect(() => {
    if (!linkElement) return;

    const handleClick = (e: MouseEvent) => {
      const isModifierKeyHeld = isMac ? e.metaKey : e.ctrlKey;
      if (!isModifierKeyHeld) return;

      e.preventDefault();
      e.stopPropagation();

      const href = linkElement.getAttribute("href");
      if (!href) return;
      const settings = (window as any).__gooseNoteSettings;
      const useInternalBrowser = settings?.utools?.openSearchInUtools ?? true;
      const utools = (window as any).utools;
      if (!utools) return;
      if (useInternalBrowser && typeof utools?.ubrowser?.goto === "function") {
        utools.ubrowser.goto(href).run();
        return;
      }
      utools?.shellOpenExternal?.(href);
    };

    linkElement.addEventListener("click", handleClick);
    return () => linkElement.removeEventListener("click", handleClick);
  }, [linkElement, isMac]);

  const handleEdit = () => {
    if (!linkElement) return;
    setEditUrl(linkElement.getAttribute("href") || "");
    setEditText(linkElement.textContent || "");
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = () => {
    if (!linkElement || !editUrl.trim()) {
      handleRemove();
      return;
    }

    const pos = editor.view.posAtDOM(linkElement, 0);
    const textLength = linkElement.textContent?.length || 0;

    if (editText !== linkElement.textContent) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: pos, to: pos + textLength })
        .deleteSelection()
        .insertContent({
          type: "text",
          text: editText || editUrl,
          marks: [{ type: "link", attrs: { href: editUrl } }],
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: pos, to: pos + textLength })
        .setLink({ href: editUrl })
        .run();
    }

    setIsVisible(false);
    setIsEditing(false);
  };

  const handleRemove = () => {
    if (!linkElement) return;

    const pos = editor.view.posAtDOM(linkElement, 0);
    const textLength = linkElement.textContent?.length || 0;

    editor
      .chain()
      .focus()
      .setTextSelection({ from: pos, to: pos + textLength })
      .unsetLink()
      .run();

    setIsVisible(false);
    setIsEditing(false);
  };

  const handleOpenLink = () => {
    const href = linkElement?.getAttribute("href");
    if (!href) return;
    const settings = (window as any).__gooseNoteSettings;
    const useInternalBrowser = settings?.utools?.openSearchInUtools ?? true;
    const utools = (window as any).utools;
    if (!utools) return;
    if (useInternalBrowser && typeof utools?.ubrowser?.goto === "function") {
      utools.ubrowser.goto(href).run();
      return;
    }
    utools?.shellOpenExternal?.(href);
  };

  const handleCopyLink = async () => {
    const href = linkElement?.getAttribute("href");
    if (!href) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
        return;
      }
    } catch {
      // ignore clipboard permission errors and fallback below
    }

    UToolsAdapter.copyToClipboard(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setIsVisible(false);
    }
  };

  if (!isVisible || !linkElement) return null;

  const href = linkElement.getAttribute("href") || "";
  const displayUrl = href.length > 35 ? href.slice(0, 35) + "..." : href;

  return (
    <TooltipProvider>
      <div
        ref={menuRef}
        data-link-hover-menu
        onMouseEnter={handleMenuMouseEnter}
        onMouseLeave={handleMenuMouseLeave}
        className="fixed z-[20000] overflow-hidden rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] animate-in fade-in-0 zoom-in-95 duration-100 dark:border-white/15 dark:bg-[#2f3437]"
        style={{ left: position.x, top: position.y }}
      >
        {isEditing ? (
          <div className="min-w-[320px] space-y-2 rounded-md bg-popover px-2 py-1.5 dark:bg-[#2f3437]">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                文字
              </Label>
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="链接文字"
                className="h-7 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                链接
              </Label>
              <Input
                ref={inputRef}
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                className="h-7 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setIsVisible(false);
                }}
                className="h-7 px-2 text-xs"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-3 text-xs"
              >
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleOpenLink}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 max-w-[220px] gap-1.5 rounded-md px-2 text-foreground/90 transition-colors hover:bg-muted"
                  aria-label={href}
                >
                  <LucideIcons.ExternalLink className="h-[15px] w-[15px] flex-shrink-0" />
                  <span className="truncate text-xs font-medium">{displayUrl}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[360px] whitespace-normal break-all">
                {href}
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 opacity-70" />

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void handleCopyLink();
                  }}
                  className="h-7 w-7 rounded-md p-0 text-foreground/90 hover:bg-muted"
                  aria-label="复制链接"
                >
                  <LucideIcons.Copy className="h-[15px] w-[15px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>复制链接</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-7 w-7 rounded-md p-0 text-foreground/90 hover:bg-muted"
                  aria-label="编辑链接"
                >
                  <LucideIcons.Pencil className="h-[15px] w-[15px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>编辑链接</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="h-7 w-7 rounded-md p-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除链接"
                >
                  <LucideIcons.Unlink className="h-[15px] w-[15px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>删除链接</p>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 opacity-70" />

            <span className="px-1 text-[11px] text-muted-foreground/85">
              {isMac ? "⌘" : "Ctrl"}+点击打开
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
