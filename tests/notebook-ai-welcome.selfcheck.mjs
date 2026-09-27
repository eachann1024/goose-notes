import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/pages/workspace/styles/notebook-ai.css", "utf8");
const messages = readFileSync(
  "src/pages/workspace/components/notebook-ai/ChatMessages.tsx",
  "utf8",
);

assert.match(css, /\.notebook-ai-empty-state\s*\{[^}]*padding:\s*86px\s+22px\s+0/s);
assert.match(css, /\.notebook-ai-empty-title\s*\{[^}]*font-size:\s*23px/s);
assert.match(css, /font-family:\s*var\(--font-default\)/);
assert.match(css, /\[data-ai-panel-layout="side-panel"\] \.notebook-ai-composer-dock\s*\{[^}]*bottom:\s*12px/s);
assert.match(css, /\.notebook-ai-empty-suggestions\s*\{\s*margin-top:\s*24px/s);
assert.match(messages, /messages\.length === 0[\s\S]*?isFullscreen \? "px-6 pt-5" : "p-0"/);
