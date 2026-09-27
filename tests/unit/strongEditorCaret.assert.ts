import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
assert(!read("src/components/editor/core/Editor.tsx").includes("gooseStrongCaretExtension"));
const css = read("src/pages/workspace/styles/editor-base/shell.css");
assert(css.includes("caret-color: var(--goose-accent-focus)"));
assert(!css.includes("caret-color: transparent"));
assert(!css.includes("goose-strong-editor-caret"));
console.log("Native editor caret checks passed");
