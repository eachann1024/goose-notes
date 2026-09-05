/**
 * 面板输入条：单行胶囊 ↔ 两行 20px 圆角。
 * 展开判断永远对照「单行槽宽」，避免展开变宽后误收回再抖回去。
 */
export const COMPOSER_PANEL_LINE_HEIGHT_PX = 24;
export const COMPOSER_EXPAND_SLACK_PX = 4;

export function shouldExpandComposer(input: {
  isEmpty: boolean;
  contentWidth: number;
  slotWidth: number;
  scrollHeight: number;
  lineHeight?: number;
  slack?: number;
}): boolean {
  const slack = input.slack ?? COMPOSER_EXPAND_SLACK_PX;
  const lineHeight = input.lineHeight ?? COMPOSER_PANEL_LINE_HEIGHT_PX;
  // 空 payload 仍可能含用户插入的换行；占位 br 只有一行，不应展开。
  if (input.isEmpty) return input.scrollHeight > lineHeight + 1;
  if (input.contentWidth > input.slotWidth - slack) return true;
  // 宽度能放下时，高度超过一行只可能是硬换行（含空的第二行），不是软折行
  return input.scrollHeight > lineHeight + 1;
}

export function measureNowrapContentSize(
  source: HTMLElement,
  host: HTMLElement,
): { width: number; height: number } {
  const clone = source.cloneNode(true) as HTMLElement;
  // 克隆会带上编辑器的 w-full / basis-full，挂到壳上后 scrollWidth 退化成壳宽
  clone.className = "";
  clone.style.cssText =
    "visibility:hidden;position:absolute;left:-9999px;top:0;" +
    "white-space:pre;width:max-content;max-width:none;height:auto;max-height:none;";
  host.appendChild(clone);
  const size = { width: clone.scrollWidth, height: clone.scrollHeight };
  clone.remove();
  return size;
}

export function measureNowrapContentWidth(source: HTMLElement, host: HTMLElement): number {
  return measureNowrapContentSize(source, host).width;
}

export function measureSingleLineSlot(options: {
  shell: HTMLElement;
  plusWidth: number;
  modelWidth: number;
  sendWidth: number;
}): number {
  const styles = getComputedStyle(options.shell);
  const paddingX =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const gap = parseFloat(styles.columnGap) || 0;
  const chromeWidth =
    options.plusWidth + options.modelWidth + options.sendWidth;
  return options.shell.clientWidth - paddingX - chromeWidth - gap * 3;
}
