/**
 * 全屏 AI 时，把面板工具栏挂到 PageHeader 右上角（取代 PageMenu 的 ··· 位置）。
 * 用轻量 external store，避免 Portal 目标时序和层层 props 透传。
 */
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

let aiHeaderActions: ReactNode = null;
let aiHeaderTitle: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** NotebookAiPanel 全屏时注册工具栏；卸载或切侧栏时清空。 */
export function setAiHeaderActions(node: ReactNode) {
  if (aiHeaderActions === node) return;
  aiHeaderActions = node;
  emit();
}

export function clearAiHeaderActions() {
  if (aiHeaderActions == null) return;
  aiHeaderActions = null;
  emit();
}

/** 全屏 AI 时把派生会话标题挂到 PageHeader / DesktopTitleBar。 */
export function setAiHeaderTitle(title: string | null) {
  if (aiHeaderTitle === title) return;
  aiHeaderTitle = title;
  emit();
}

export function clearAiHeaderTitle() {
  if (aiHeaderTitle == null) return;
  aiHeaderTitle = null;
  emit();
}

export function useAiHeaderActions(): ReactNode {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => aiHeaderActions,
    () => null,
  );
}

export function useAiHeaderTitle(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => aiHeaderTitle,
    () => null,
  );
}
