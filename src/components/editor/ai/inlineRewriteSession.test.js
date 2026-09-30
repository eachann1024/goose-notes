import { describe, expect, test } from "bun:test";
import { createInlineRewriteSession } from "./inlineRewriteSession";
function fixture() {
  let state = "closed";
  let scope = "page-a";
  let editable = true;
  let writes = 0;
  let signal;
  let finish;
  let fail;
  let update;
  const ai = createInlineRewriteSession({
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    capture: () => scope,
    validate: (target) => {
      if (scope !== target || !editable) throw new Error("stale or locked");
    },
    rewrite: (_target, _prompt, abortSignal, onUpdate) => {
      signal = abortSignal;
      update = onUpdate;
      return new Promise((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
    },
    prepare: (_target, markdown) => markdown,
    apply: () => {
      writes++;
    },
  });
  ai.openAIMenuAtBlock("a");
  return {
    ai,
    state: () => state,
    writes: () => writes,
    signal: () => signal,
    resolver: () => finish,
    finish: (text = "draft") => finish(text),
    fail: () => fail(new Error("network")),
    update: () => update("late ticker"),
    switchPage: () => {
      scope = "page-b";
    },
    lock: () => {
      editable = false;
    },
  };
}
describe("inline drafts", () => {
  test("generation and rejection never write; acceptance writes exactly once", async () => {
    const f = fixture();
    const first = f.ai.submit("polish");
    f.finish();
    await first;
    expect(f.writes()).toBe(0);
    expect(f.state()).toMatchObject({ status: "user-reviewing" });
    f.ai.rejectChanges();
    expect(f.state()).toMatchObject({
      status: "user-input",
      prompt: "polish",
      draft: "",
    });
    expect(f.writes()).toBe(0);
    const second = f.ai.retry();
    f.finish();
    await second;
    f.ai.acceptChanges();
    f.ai.acceptChanges();
    expect(f.writes()).toBe(1);
  });
  for (const action of ["abort", "closeAIMenu", "rejectChanges"]) {
    test(`${action} ignores late successful response and ticker`, async () => {
      const f = fixture();
      const pending = f.ai.submit("polish");
      f.ai[action]();
      const expected = f.state();
      expect(f.signal()?.aborted).toBe(true);
      f.update();
      f.finish();
      await pending;
      expect(f.state()).toEqual(expected);
      expect(f.writes()).toBe(0);
    });
  }
  test("old response cannot overwrite newer request", async () => {
    const f = fixture();
    const first = f.ai.submit("first");
    const oldFinish = f.resolver();
    f.ai.abort();
    const second = f.ai.submit("second");
    f.finish("second draft");
    await second;
    oldFinish("obsolete draft");
    await first;
    expect(f.state()).toMatchObject({
      prompt: "second",
      draft: "second draft",
    });
    expect(f.writes()).toBe(0);
    void first;
  });
  test("switch page closes session before late response", async () => {
    const f = fixture();
    const pending = f.ai.submit("polish");
    f.switchPage();
    f.ai.invalidateIfNeeded();
    f.finish();
    await pending;
    expect(f.state()).toBe("closed");
    expect(f.writes()).toBe(0);
  });
  test("lock between preview and acceptance prevents writing", async () => {
    const f = fixture();
    const pending = f.ai.submit("polish");
    f.finish();
    await pending;
    f.lock();
    f.ai.acceptChanges();
    expect(f.writes()).toBe(0);
    expect(f.state()).toMatchObject({ status: "error" });
  });
  test("failure can retry with original prompt without writes", async () => {
    const f = fixture();
    const pending = f.ai.submit("translate");
    f.fail();
    await pending;
    expect(f.state()).toMatchObject({ status: "error", prompt: "translate" });
    const retry = f.ai.retry();
    f.finish();
    await retry;
    expect(f.state()).toMatchObject({
      status: "user-reviewing",
      prompt: "translate",
    });
    expect(f.writes()).toBe(0);
  });
});
