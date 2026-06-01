/**
 * EditorPlatform 注入上下文。
 *
 * 编辑器内核通过 `useEditorPlatform()` 取得平台能力，永不直接 import 宿主实现。
 * 宿主在树上层包一层 <EditorPlatformProvider platform={...}>；无 Provider 时回退到
 * noopPlatform，保证 build 与不崩。
 *
 * 非 React 调用点（BlockNote/ProseMirror extension 回调）无法用 hook，改用
 * `getEditorPlatform()` 读取模块级单例；Provider 挂载时同步该单例。
 *
 * 来源：plans/2026-06-01-Tauri迁移与编辑器抽取计划/extraction-blueprint.md §1 / §4 Step 4
 */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { EditorPlatform } from "./types";
import { noopPlatform } from "./noopPlatform";

const EditorPlatformContext = createContext<EditorPlatform>(noopPlatform);

// 模块级单例：供非 React 调用点（extension 回调）读取
let currentPlatform: EditorPlatform = noopPlatform;

/** 非 React 调用点取平台能力（extension 回调等）。 */
export function getEditorPlatform(): EditorPlatform {
  return currentPlatform;
}

export function EditorPlatformProvider({
  platform,
  children,
}: {
  platform: EditorPlatform;
  children: ReactNode;
}) {
  // 同步模块级单例，供非 React 调用点读取
  useEffect(() => {
    currentPlatform = platform;
    return () => {
      currentPlatform = noopPlatform;
    };
  }, [platform]);

  return (
    <EditorPlatformContext.Provider value={platform}>
      {children}
    </EditorPlatformContext.Provider>
  );
}

export function useEditorPlatform(): EditorPlatform {
  return useContext(EditorPlatformContext);
}
