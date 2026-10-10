import { useEffect } from "react";
import {
  QUICKNOTE_MIN_WIDTH,
  QUICKNOTE_MIN_HEIGHT,
} from "@/stores/useQuickNote";
import { quickNoteWindow } from "@/lib/electron/quickNoteWindow";
import {
  POSITION_POLL_IDLE_MS,
  POSITION_POLL_DRAG_MS,
  POSITION_SETTLE_MS,
} from "./shared";
import type { useQuickNoteShortcuts } from "./useQuickNoteShortcuts";

export function useQuickNoteWindowPlacement(
  input: ReturnType<typeof useQuickNoteShortcuts>,
) {
  const {
    setWindowSize,
    setWindowPosition,
    isResizingRef,
    resizeSettleTimerRef,
  } = input;

  // 窗口位置记忆：用户拖动窗口移动 → 停下后记住最终位置，下次开窗沿用。
  // 仅在前台且有焦点时轮询；空闲 500ms，拖动中升到 120ms（须短于 settle，避免反复 IPC）。
  useEffect(() => {
    let lastX = window.screenX;
    let lastY = window.screenY;
    let settleTimer: number | null = null;
    let pollTimer: number | null = null;
    let pollMs = POSITION_POLL_IDLE_MS;

    const stopPoll = () => {
      if (pollTimer === null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPoll = (ms: number) => {
      stopPoll();
      pollMs = ms;
      pollTimer = window.setInterval(() => {
        const x = window.screenX;
        const y = window.screenY;
        if (x === lastX && y === lastY) return;
        lastX = x;
        lastY = y;
        if (settleTimer !== null) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          settleTimer = null;
          const sx = window.screenX;
          const sy = window.screenY;
          // preload 权威写 db；store 同步一份，避免后续草稿 persist 用旧坐标盖掉位置。
          quickNoteWindow.persistPosition(sx, sy);
          setWindowPosition(sx, sy);
          if (pollMs !== POSITION_POLL_IDLE_MS)
            startPoll(POSITION_POLL_IDLE_MS);
        }, POSITION_SETTLE_MS);
        if (pollMs !== POSITION_POLL_DRAG_MS) startPoll(POSITION_POLL_DRAG_MS);
      }, ms);
    };

    const syncPolling = () => {
      const shouldPoll =
        document.visibilityState === "visible" && document.hasFocus();
      if (shouldPoll) {
        if (pollTimer === null) startPoll(pollMs);
        return;
      }
      stopPoll();
    };

    syncPolling();
    document.addEventListener("visibilitychange", syncPolling);
    window.addEventListener("focus", syncPolling);
    window.addEventListener("blur", syncPolling);
    return () => {
      stopPoll();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      document.removeEventListener("visibilitychange", syncPolling);
      window.removeEventListener("focus", syncPolling);
      window.removeEventListener("blur", syncPolling);
    };
  }, [setWindowPosition]);

  // 窗口尺寸记忆：用户拖动窗口边框改宽高 → 停下后记住最终尺寸，下次开窗沿用。
  useEffect(() => {
    const onResize = () => {
      isResizingRef.current = true;
      if (resizeSettleTimerRef.current !== null) {
        window.clearTimeout(resizeSettleTimerRef.current);
      }
      resizeSettleTimerRef.current = window.setTimeout(() => {
        resizeSettleTimerRef.current = null;
        isResizingRef.current = false;
        // 持久化由主窗用 win.getSize() 权威读取后写回 dbStorage：子窗渲染进程的
        // outerWidth 在 Electron frameless 窗口里 resize 后并不更新，直接存会记错值，
        // 导致下次开窗仍回默认宽度（用户每次都要重新拉宽）。
        quickNoteWindow.persistSize();
        // 同步进程内 store（best-effort），用视口宽高兜底，开窗尺寸以 dbStorage 为准。
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w >= QUICKNOTE_MIN_WIDTH && h >= QUICKNOTE_MIN_HEIGHT) {
          setWindowSize(w, h);
        }
      }, 240);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (resizeSettleTimerRef.current !== null) {
        window.clearTimeout(resizeSettleTimerRef.current);
        resizeSettleTimerRef.current = null;
      }
      window.removeEventListener("resize", onResize);
    };
  }, [setWindowSize]);
  return { ...input };
}
