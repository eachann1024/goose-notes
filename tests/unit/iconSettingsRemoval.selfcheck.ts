import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path: string) => readFileSync(`src/${path}`, "utf8");
const root = "pages/workspace/components/";
for (const path of [
  "page/DesktopTitleBar.tsx", "page/PageHeader.tsx", "sidebar/SidebarContextMenu.tsx",
  "sidebar/NotebookCreateDialog.tsx", "sidebar/NotebookEditDialog.tsx",
]) {
  assert.doesNotMatch(read(root + path), /IconSelector|PageIconButton|设置图标|选择图标/);
}
for (const [file, actions] of [
  ["DesktopTitleBar.tsx", '<div className="flex shrink-0 items-center gap-2">'],
  ["PageHeader.tsx", '<div className="ml-2 flex shrink-0 items-center gap-1">'],
]) {
  const source = read(root + "page/" + file);
  assert(source.indexOf("ai-icon-button") > source.indexOf(actions));
  assert(source.includes("onClick={onToggleAiPanel}"));
  assert(source.includes("aria-pressed={aiPanelOpen}"));
}
assert.doesNotMatch(read(root + "page/TabRail.tsx"), /showAiOnTabRail|ai-icon-button/);
assert.doesNotMatch(read("components/editor/blocks/callout/calloutBlock.tsx"), /IconSelector|CalloutIconPicker/);
assert(!existsSync("src/" + root + "shared/IconSelector.tsx"));
console.log("icon settings removal and right-side AI checks passed");
