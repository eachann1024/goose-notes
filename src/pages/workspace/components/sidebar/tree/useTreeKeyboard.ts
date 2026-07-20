/**
 * useTreeKeyboard.ts
 * 侧边树键盘导航 hook（预留结构）。
 * 当前版本为空壳，未来可在此扩展上下箭头、回车展开/折叠、Esc 等快捷键。
 */

export interface UseTreeKeyboardOptions {
  /** 当前高亮的页面 ID */
  highlightedPageId: string | null | undefined;
  /** 切换节点展开/折叠 */
  onToggle: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useTreeKeyboard(_options: UseTreeKeyboardOptions): void {
  // 预留：未来在此绑定 keydown 事件处理键盘导航
}
