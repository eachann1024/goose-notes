export function shouldDismissSidebarOverlay(
  event: KeyboardEvent,
  root: Pick<Document, "activeElement" | "querySelector">,
): boolean {
  if (
    event.key !== "Escape" || event.defaultPrevented || event.repeat ||
    event.isComposing || event.keyCode === 229 || event.which === 229 ||
    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
  ) return false;

  for (const target of [event.target, root.activeElement]) {
    const element = target as HTMLElement | null;
    if (element?.isContentEditable || element?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-shortcut-recorder]',
    )) return false;
  }

  return !root.querySelector(
    'dialog[open], :is([role="dialog"], [role="alertdialog"], [role="menu"]):not([data-state="closed"]):not([hidden]):not([aria-hidden="true"]), [data-goose-floating-content][data-state="open"]',
  );
}
