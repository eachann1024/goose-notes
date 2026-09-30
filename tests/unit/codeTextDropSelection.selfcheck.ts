import assert from "node:assert/strict";
import { Schema } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { gooseCodeTextDropExtension } from "../../src/components/editor/extensions/codeTextDropExtension";

class FakeElement { constructor(private readonly find: (selector: string) => any) {} closest(selector: string) { return this.find(selector); } }
(globalThis as any).Element = FakeElement;
const schema = new Schema({ nodes: { doc: { content: "block+" }, p: { content: "text*", group: "block" }, text: {} } });
const doc = schema.node("doc", null, [schema.node("p", null, schema.text("one")), schema.node("p", null, schema.text("two"))]);
const handlers = new Map<string, Function>();
const dom = { addEventListener: (n: string, f: Function) => handlers.set(`dom:${n}`, f) };
const view: any = { state: { doc, selection: TextSelection.create(doc, 1, 9) }, posAtCoords: () => ({ pos: 2 }), dispatch() { this.dispatched++; }, dispatched: 0 };
const factory = gooseCodeTextDropExtension as any;
const mount = (document: any) => {
  (globalThis as any).document = document;
  const extension = factory()({ editor: { prosemirrorView: view } });
  extension.mount({ dom, signal: new AbortController().signal });
};
const oldWindow = (globalThis as any).window;
const oldDocument = (globalThis as any).document;
(globalThis as any).window = { getSelection: () => ({ toString: () => "one\ntwo" }) };
let up!: Function;
mount({ addEventListener: (_: string, fn: Function) => { up = fn; } });
const down = (target: any, x = 1, y = 2) => {
  const event: any = { button: 0, target, clientX: x, clientY: y, preventDefault() { this.prevented = true; } };
  handlers.get("dom:mousedown")!(event);
  return event;
};
const selected = new FakeElement(() => ({}));
assert.equal(down(selected).prevented, undefined, "selection mousedown remains uncancelled");
down(selected);
view.state = { ...view.state, doc: { eq: () => false } };
up({ target: new FakeElement(() => { throw new Error("resolved target for stale document"); }), clientX: 10, clientY: 10 });
assert.equal(view.dispatched, 0);
view.state = { doc, selection: TextSelection.create(doc, 1, 9) };
down(selected);
up({ target: new FakeElement(() => null), clientX: 1, clientY: 2 });
assert.equal(view.dispatched, 0, "same-position click does not dispatch");
down(selected);
up({ target: new FakeElement(() => null), clientX: 10, clientY: 10 });
assert.equal(view.dispatched, 0, "mouseup outside code does not dispatch");
(globalThis as any).window = oldWindow;
(globalThis as any).document = oldDocument;
console.log("codeTextDrop selection self-check passed");
