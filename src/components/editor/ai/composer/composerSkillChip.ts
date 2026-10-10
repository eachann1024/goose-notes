import type { AiSkillCommandAttrs } from "./referenceTypes";

/** Skill chip：contentEditable=false，样式对齐 mention chip */
export function createSkillChipElement(
  attrs: AiSkillCommandAttrs,
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.aiSkillAttrs = JSON.stringify(attrs);
  // 高度/行高/垂直对齐由 notebook-ai.css 与编辑器行高对齐；勿加 leading-none/h-*
  span.className =
    "ai-composer-chip inline-flex items-center justify-center rounded text-[11px] font-medium" +
    " bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] border border-border" +
    " cursor-pointer hover:bg-[var(--goose-interactive-hover)] select-none";
  span.textContent = `/${attrs.name}`;
  return span;
}
