// node tests/unit/aiComposerPageSync.selfcheck.mjs [AiComposerInput.tsx]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(process.argv[2] ?? new URL(
  "../../src/components/editor/ai/composer/AiComposerInput.tsx", import.meta.url,
), "utf8");
const effect = source.split("// ── sync initialContent → DOM")[1]
  ?.match(/useEffect\(\(\) => \{([\s\S]*?)\n    \},/)?.[1];
assert.ok(effect, "test must execute the actual content hydration effect");

// ponytail: 单测只执行水合 effect；真实 React 重渲染与切页交互由浏览器验收。
const a = { pageId: "a" };
const b = { pageId: "b" };
const editor = { content: a };
let writes = 0;
const state = {
  initialContent: a,
  lastReceivedContentRef: { current: a },
  lastEmittedContentRef: { current: a },
  editorRef: { current: editor },
  imageRegistryRef: { current: new Map() },
  isEmptyRef: { current: false },
  setDomFromJsonContent(el, content) { el.content = content; writes++; },
  syncReferenceTitles() {},
  readTokensFromDom: (el) => el.content,
  buildPayloadFromTokens: (tokens) => tokens,
  isComposerPayloadEmpty: (payload) => payload == null,
  setIsEmpty() {},
  onIsEmptyChange() {},
};
const rerender = () => runInNewContext(`(() => {${effect}\n})()`, state);
rerender();
assert.equal(writes, 0, "mount already hydrated the editor");

for (const content of [b, a, b, { text: "保留未发送草稿" }, null]) {
  editor.content = content;
  state.lastEmittedContentRef.current = content;
  rerender();
  assert.equal(editor.content, content, "callback-only rerenders must not restore the initial page");
}
assert.equal(writes, 0, "page switching, typing and clearing preserve the live DOM");

const external = { text: "外部恢复的新草稿" };
state.initialContent = external;
rerender();
assert.equal(editor.content, external, "genuine external content still hydrates");
assert.equal(writes, 1);

const emitted = { text: "用户继续输入" };
editor.content = emitted;
state.lastEmittedContentRef.current = emitted;
state.initialContent = emitted;
rerender();
assert.equal(writes, 1, "parent echo must not rebuild DOM or selection");
state.initialContent = a;
rerender();
assert.equal(editor.content, a, "explicitly restoring the original page still works");
assert.equal(writes, 2);
console.log("aiComposerPageSync.selfcheck: PASS");
