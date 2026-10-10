import { useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { applyHeadingBlockBackground } from "./headingBlockBackground";
import {
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  COLOR_PREVIEW,
  BG_PREVIEW,
} from "./colorPalette";
import {
  readLastFormatColors,
  writeLastFormatColors,
  selectionUsesLastFormatColors,
  type LastFormatColors,
} from "./lastFormatColors";
import type { useColorPanelState } from "./useColorPanelState";

export function useColorActions(
  editor: BlockNoteEditor<any, any, any>,
  panel: ReturnType<typeof useColorPanelState>,
) {
  const { applyWithHeldSelection, displayColors } = panel;
  const [lastColors, setLastColors] =
    useState<LastFormatColors>(readLastFormatColors);

  const applyTextColor = (color: string) => {
    applyWithHeldSelection(
      () => {
        if (color === "default") {
          editor.removeStyles({ textColor: true } as any);
        } else {
          editor.addStyles({ textColor: color });
        }
        rememberLastFormatColors({ textColor: color });
      },
      { textColor: color },
    );
  };

  const applyBackgroundColor = (color: string) => {
    applyWithHeldSelection(
      () => {
        if (applyHeadingBlockBackground(editor, color)) {
          rememberLastFormatColors({ backgroundColor: color });
          return;
        }
        if (color === "default") {
          editor.removeStyles({ backgroundColor: true } as any);
        } else {
          editor.addStyles({ backgroundColor: color });
        }
        rememberLastFormatColors({ backgroundColor: color });
      },
      { backgroundColor: color },
    );
  };

  const applyColorPair = (index: number) => {
    const textColor = TEXT_COLORS[index]?.color;
    const backgroundColor = HIGHLIGHT_COLORS[index]?.color;
    if (!textColor || !backgroundColor) return;
    applyWithHeldSelection(
      () => {
        // 先应用样式再一次写入，避免两次 localStorage 读写
        if (textColor === "default") {
          editor.removeStyles({ textColor: true } as any);
        } else {
          editor.addStyles({ textColor: textColor });
        }
        if (applyHeadingBlockBackground(editor, backgroundColor)) {
          // 标题背景已按完整块应用。
        } else if (backgroundColor === "default") {
          editor.removeStyles({ backgroundColor: true } as any);
        } else {
          editor.addStyles({ backgroundColor: backgroundColor });
        }
        rememberLastFormatColors({ textColor, backgroundColor });
      },
      { textColor, backgroundColor },
    );
  };

  const rememberLastFormatColors = (patch: LastFormatColors) => {
    writeLastFormatColors(patch);
    setLastColors(readLastFormatColors());
  };

  const lastTextPreview =
    lastColors.textColor && lastColors.textColor !== "default"
      ? COLOR_PREVIEW[lastColors.textColor]
      : undefined;
  const lastBgPreview =
    lastColors.backgroundColor && lastColors.backgroundColor !== "default"
      ? BG_PREVIEW[lastColors.backgroundColor]
      : undefined;
  const lastColorBar = lastBgPreview ?? lastTextPreview;

  const applyLastFormatColors = () => {
    const last = readLastFormatColors();
    if (last.textColor === undefined && last.backgroundColor === undefined) {
      return;
    }
    const clearing = selectionUsesLastFormatColors(displayColors, last);
    applyWithHeldSelection(
      () => {
        if (clearing) {
          editor.removeStyles({ textColor: true } as any);
          if (!applyHeadingBlockBackground(editor, "default")) {
            editor.removeStyles({ backgroundColor: true } as any);
          }
          return;
        }
        if (last.textColor !== undefined) {
          // 直接应用，不经 applyTextColor，避免把「未记忆的那一侧」误写成当前值
          if (last.textColor === "default") {
            editor.removeStyles({ textColor: true } as any);
          } else {
            editor.addStyles({ textColor: last.textColor });
          }
        }
        if (last.backgroundColor !== undefined) {
          if (applyHeadingBlockBackground(editor, last.backgroundColor)) {
            // 标题背景已按完整块应用。
          } else if (last.backgroundColor === "default") {
            editor.removeStyles({ backgroundColor: true } as any);
          } else {
            editor.addStyles({ backgroundColor: last.backgroundColor });
          }
        }
      },
      clearing
        ? {
            textColor:
              last.textColor !== undefined
                ? "default"
                : displayColors.textColor,
            backgroundColor:
              last.backgroundColor !== undefined
                ? "default"
                : displayColors.backgroundColor,
          }
        : {
            ...(last.textColor !== undefined
              ? { textColor: last.textColor }
              : {}),
            ...(last.backgroundColor !== undefined
              ? { backgroundColor: last.backgroundColor }
              : {}),
          },
    );
  };

  return {
    applyTextColor,
    applyBackgroundColor,
    applyColorPair,
    applyLastFormatColors,
    lastTextPreview,
    lastColorBar,
  };
}
