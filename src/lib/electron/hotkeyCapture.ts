/** 设置页快捷键录制框：全局热键必须先卸掉，否则系统会先消费按键。 */
export function isShortcutRecorderTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-shortcut-recorder]"));
}

export function shouldResumeGlobalHotkeysAfterFocusOut(
  currentTarget: EventTarget | null,
  nextTarget: EventTarget | null,
): boolean {
  if (!isShortcutRecorderTarget(currentTarget)) return false;
  return !isShortcutRecorderTarget(nextTarget);
}
