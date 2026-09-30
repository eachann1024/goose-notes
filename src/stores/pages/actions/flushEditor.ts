export const flushEditorContent = (immediate = false) => {
  if (typeof window === "undefined") return;
  const EventConstructor = window.CustomEvent ?? globalThis.CustomEvent;
  if (typeof EventConstructor !== "function") return;
  window.dispatchEvent(
    new EventConstructor("goose-note:flush-editor", {
      detail: { immediate },
    }),
  );
};
