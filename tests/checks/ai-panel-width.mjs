// Run: node tests/checks/ai-panel-width.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const base = new URL("../../src/pages/workspace/components/notebook-ai/", import.meta.url);
const hook = readFileSync(new URL("usePanelWidth.ts", base), "utf8");
const body = hook.match(/function clamp\(v: number\) \{([\s\S]*?)\n\}/)[1];
const clamp = (v) => runInNewContext(`(() => {${body}})()`, { v, MIN_WIDTH: 320, DEFAULT_WIDTH: 360 });
assert.equal(clamp(240), 320);
for (const width of [560, 900, 1600]) assert.equal(clamp(width), width);
for (const width of [NaN, Infinity, -Infinity]) assert.equal(clamp(width), 360);
const panel = readFileSync(new URL("NotebookAiPanel.tsx", base), "utf8");
assert.ok(panel.includes("Math.min(width, availableRoom)"));
assert.ok(!panel.includes("PANEL_WIDTH_MAX"));
console.log("AI panel width checks passed");
