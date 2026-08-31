/**
 * 按编译期 __HOST_TARGET__ 选择 EditorPlatform 实例。
 *
 * __HOST_TARGET__ 是 vite define 常量：uTools 构建里该三元折叠为常量 false 分支，
 * electronEditorPlatform 失去引用后连同本模块对 ./electron 的 import 被整体 tree-shake，
 * electron 预加载（electron.ts 只碰 window.gooseDesktop）不会进入 dist/ 产物。
 */
import type { EditorPlatform } from "@/components/editor/platform/types";
import { utoolsEditorPlatform } from "./utools";
import { electronEditorPlatform } from "./electron";

export const editorPlatform: EditorPlatform =
  __HOST_TARGET__ === "electron" ? electronEditorPlatform : utoolsEditorPlatform;
