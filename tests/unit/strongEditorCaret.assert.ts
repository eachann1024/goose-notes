// Run: bun tests/unit/strongEditorCaret.assert.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const plugin = read("src/components/editor/extensions/strongCaretExtension.ts");
const css = read("src/pages/workspace/styles/editor-base/shell.css");
assert(read("src/components/editor/core/Editor.tsx").includes("gooseStrongCaretExtension,"));
for (const guard of ["doc.activeElement !== view.dom", "view.composing", "!selection.empty", "coordsAtPos(selection.head)", "caret.remove()"])
  assert(plugin.includes(guard), guard);
assert(plugin.includes("inlineCodeEdgeAt(selection.$head, codeType)"));
assert(plugin.includes("domSelection.getRangeAt(0).getBoundingClientRect()"));
assert(css.includes("width: 5px"));
assert(css.includes("background: var(--goose-accent-focus)"));
console.log("PASS: editor strong caret wiring and native fallback");
