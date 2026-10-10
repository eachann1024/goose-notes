import { type CSSProperties } from "react";
import { CircleAlert, FilePlus2, X, Pencil } from "@/components/ui/icons";
import { getQuickNoteSlotName } from "@/stores/useQuickNote";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { QuickNoteSlotSwitcher } from "../QuickNoteSlotSwitcher";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import { formatShortcut, getPlatformKind } from "@/lib/utils";
import type { useQuickNoteWindowPlacement } from "./useQuickNoteWindowPlacement";

export function renderQuickNoteHeader(
  context: ReturnType<typeof useQuickNoteWindowPlacement>,
) {
  const {
    activeSlot,
    helpOpen,
    savingToNote,
    renamingSlot,
    renameValue,
    setRenameValue,
    renameInputRef,
    slotNames,
    helpShortcuts,
    displaySlot,
    displaySlotName,
    occupiedSlots,
    startRename,
    finishRename,
    handleSwitchSlot,
    handleHelpOpenChange,
    handleSaveToNote,
    handlePreviewSlot,
    persistPlacementThenClose,
  } = context;
  return (
    <div
      className="quicknote-titlebar-reveal-zone"
      data-renaming={renamingSlot === null ? "false" : "true"}
    >
      {renamingSlot !== null && (
        <input
          ref={renameInputRef}
          value={renameValue}
          maxLength={24}
          aria-label={`重命名便签 ${renamingSlot}`}
          className="quicknote-slot-name-input"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={() => finishRename(true)}
          onKeyDown={(event) => {
            // 中文输入法按 Enter 确认候选词时不能提前提交；keyCode 229 兼容旧 Chromium。
            if (
              isImeKeyboardEvent(event.nativeEvent) ||
              isImeKeyboardEvent(event)
            ) {
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              finishRename(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finishRename(false);
            }
          }}
        />
      )}
      <div
        className="quicknote-titlebar"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <div className="quicknote-titlebar-left">
          <button
            type="button"
            aria-label="修改标签名称"
            title={`${displaySlotName} · 修改标签名称`}
            className="quicknote-slot-name-display quicknote-titlebar-btn"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            onClick={() => startRename(activeSlot)}
          >
            <span
              key={`${displaySlot}-${displaySlotName}`}
              className="quicknote-slot-name-text"
            >
              {displaySlotName}
            </span>
          </button>
        </div>

        {/* 绝对居中，避免左右内容宽度差导致视觉偏移 */}
        <div className="quicknote-slot-switcher-positioner">
          <div className="quicknote-slot-switcher-interactive">
            <QuickNoteSlotSwitcher
              activeSlot={activeSlot}
              occupiedSlots={occupiedSlots}
              slotNames={slotNames}
              onChange={handleSwitchSlot}
              onPreviewChange={handlePreviewSlot}
              onRenameRequest={startRename}
            />
          </div>
        </div>

        <div className="quicknote-titlebar-actions">
          <button
            type="button"
            aria-label="保存到笔记"
            title={
              occupiedSlots[activeSlot]
                ? "保存到笔记"
                : "便签内容为空，无法保存"
            }
            className="quicknote-titlebar-btn quicknote-save-btn"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            disabled={savingToNote || !occupiedSlots[activeSlot]}
            aria-busy={savingToNote}
            onClick={() => {
              void handleSaveToNote();
            }}
          >
            <FilePlus2 className="h-3 w-3" />
          </button>
          <Popover open={helpOpen} onOpenChange={handleHelpOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="使用说明"
                title="使用说明"
                className="quicknote-titlebar-btn quicknote-help-trigger"
                style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
              >
                <CircleAlert className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              collisionPadding={8}
              className="quicknote-help-popover w-72 text-xs"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <div className="quicknote-help-heading">
                <div className="text-sm font-medium">速记便签</div>
                <p>
                  内容默认只留在当前便签。点「保存到笔记」会在当前笔记本新建一篇，并清空这张便签。
                </p>
              </div>
              <button
                type="button"
                className="quicknote-help-rename flex w-full items-center gap-2 text-left text-xs text-foreground"
                onClick={() => startRename(activeSlot)}
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">重命名当前便签</span>
                <span className="max-w-24 truncate text-muted-foreground">
                  {getQuickNoteSlotName(activeSlot, slotNames)}
                </span>
              </button>
              <ul className="quicknote-help-list text-muted-foreground">
                <li>
                  <b className="text-foreground">切换</b>
                  ：顶部 1–5 是五个独立便签。点击或拖动切换；也可按
                  {helpShortcuts.switchSlots}
                  {helpShortcuts.alternateSwitchSlots
                    ? `，或 ${helpShortcuts.alternateSwitchSlots}`
                    : ""}
                  。
                </li>
                <li>
                  <b className="text-foreground">编辑</b>：
                  {helpShortcuts.zoomIn} / {helpShortcuts.zoomOut} 缩放，
                  {helpShortcuts.zoomReset} 复位；{helpShortcuts.undo} 撤销，
                  {helpShortcuts.redo} 或 {helpShortcuts.alternateRedo} 重做。
                </li>
                <li>
                  <b className="text-foreground">保存</b>
                  ：点右上角
                  <FilePlus2 className="mx-0.5 inline h-3 w-3 align-text-bottom" />
                  把当前便签写入当前笔记本，保存后清空并回到空白。
                </li>
                <li>
                  <b className="text-foreground">收起</b>
                  ：小窗始终置顶；按 {formatShortcut(
                    "Esc",
                    getPlatformKind(),
                  )}{" "}
                  或点右上角
                  <X className="mx-0.5 inline h-3 w-3 align-text-bottom" />
                  收起。草稿、位置、尺寸和缩放都会保留。
                </li>
              </ul>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            aria-label="关闭"
            className="quicknote-titlebar-btn quicknote-close-btn"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
            onClick={() => persistPlacementThenClose()}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
