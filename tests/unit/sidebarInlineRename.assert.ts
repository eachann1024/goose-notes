// Run: bun tests/unit/sidebarInlineRename.assert.ts
// Static wiring checks; native focus and input-method behavior still need app verification.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = new URL("../../src/pages/workspace/components/sidebar/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, base), "utf8");
const input = read("SidebarInlineRename.tsx");
const menu = read("SidebarContextMenu.tsx");
assert(!menu.includes("SidebarRenameDialog"));
assert(!read("Sidebar.tsx").includes("SidebarRenameDialog"));
for (const file of ["main-tree/MainTreeItem.tsx", "tree/TreeRow.tsx"]) {
  assert(read(file).includes("<SidebarInlineRename>"), file);
}
for (const contract of [
  'background: "transparent"', 'border: 0', 'font: "inherit"',
  'event.nativeEvent.isComposing', 'event.nativeEvent.keyCode === 229',
  'event.key === "Enter"', 'event.key === "Escape"',
  'syncCaret(); void commit();', 'committing.current || finished.current',
  'readOnly={busy}', 'aria-invalid={!!error}', 'renameLocalPageFile(live.id, next)',
  'withInternalPageTitle(live.content, next)', 'toast.error(message)',
]) assert(input.includes(contract), contract);
assert(menu.includes('event.key === "F2"'));
assert(menu.includes("onDragStartCapture"));
assert(!input.includes(".select()"));
assert(input.includes("input.setSelectionRange(input.value.length, input.value.length)"));
assert(input.includes("onSelect={syncCaret}"));
assert(input.includes("onScroll={syncCaret}"));
assert(read("sidebar-inline-rename.css").includes("width: 4px"));
console.log("PASS: inline rename wiring, appearance, keyboard and save guards");
