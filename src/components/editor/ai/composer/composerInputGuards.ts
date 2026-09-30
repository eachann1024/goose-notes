/**
 * IME / 删除 inputType 判定与防抖间隔。
 * 被 AiComposerInput 与 imeInput 单测使用。
 * 无外部依赖。
 */

/**
 * 是否允许在本次 input 里同步做 React setState / 写草稿 / 探测 @/。
 *
 * 微信输入法 + contenteditable + 旧 Chromium 的坑：
 * - 经常不发 compositionstart/end，只给 keyCode 229
 * - InputEvent.isComposing 也可能一直是 false
 * - 组合过程中任何 React 重渲染都可能卡死候选窗 / 整页
 */
export function shouldProcessComposerInput(options: {
  isComposingFlag: boolean;
  imeSessionActive?: boolean;
  inputEventIsComposing?: boolean;
}): boolean {
  return !(
    options.isComposingFlag ||
    options.imeSessionActive === true ||
    options.inputEventIsComposing === true
  );
}

/**
 * 非 IME 输入防抖：避免快打/连删时同步 setState + 扫 DOM + 写 Electron。
 * 注意：IME 会话绝不能靠短超时自动结束——选词窗停住时无按键，
 * 超时 flush 会在组合中 setState，微信输入法必卡。
 */
export const COMPOSER_INPUT_FLUSH_MS = 200;
/** 整行/全选删除、剪切等批量变更：更长防抖，等浏览器改完 DOM 再扫 */
export const COMPOSER_DELETE_FLUSH_MS = 350;
/** 有 chip 时自定义删除：再稍长一点，避开 contenteditable 内部慢路径 */
export const COMPOSER_CHIP_DELETE_FLUSH_MS = 400;

export function isComposerDeleteInputType(inputType: string | undefined) {
  if (!inputType) return false;
  return (
    inputType.startsWith("delete") ||
    inputType === "historyUndo" ||
    inputType === "historyRedo"
  );
}
