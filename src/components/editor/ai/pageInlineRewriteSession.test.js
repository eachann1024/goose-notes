import { describe, expect, test } from "bun:test";
import { createPageInlineRewriteSession } from "./pageInlineRewriteSession";
const target = { sourceBlockIds: ["a"], parts: [{ oldMarkdown: "original" }] };
function pendingSession() {
  const session = createPageInlineRewriteSession("page");
  session.open(target);
  let finish, update, signal;
  const pending = session.submit("polish", (_old, _prompt, abort, tick) => {
    update = tick; signal = abort;
    return new Promise((resolve) => { finish = resolve; });
  });
  return { session, pending, finish: (value) => finish(value), update: (value) => update(value), signal: () => signal };
}
describe("in-memory page requests", () => {
  for (const action of ["stop", "close"]) {
    test(`${action} prevents late updates and responses`, async () => {
      const f = pendingSession();
      f.session[action]();
      const expected = f.session.state;
      expect(f.signal().aborted).toBe(true);
      f.update("late ticker"); f.finish("late draft"); await f.pending;
      expect(f.session.state).toEqual(expected);
      expect(f.session.drafts).toEqual([]);
    });
  }
  test("retry owns the result even if obsolete request completes last", async () => {
    const f = pendingSession();
    await f.session.submit("retry", async () => "latest");
    f.finish("obsolete"); await f.pending;
    expect(f.session.drafts).toEqual(["latest"]);
    expect(f.session.state.prompt).toBe("retry");
  });
  test("typed but unsubmitted input survives unsubscribe and does not overwrite retry prompt", async () => {
    const session = createPageInlineRewriteSession("page");
    session.open(target);
    const unsubscribe = session.subscribe(() => {});
    session.setInput("unsent instruction"); unsubscribe();
    expect(session.state.input).toBe("unsent instruction");
    expect(session.state.prompt).toBe("");
    await session.submit("polish", async () => "draft");
    session.setInput("a different unsent instruction");
    expect(session.state.prompt).toBe("polish");
    expect(session.state.input).toBe("a different unsent instruction");
    expect(session.drafts).toEqual(["draft"]);
  });
  test("failure and empty output can retry without changing target", async () => {
    const f = pendingSession(); f.finish("  "); await f.pending;
    expect(f.session.state.status).toBe("error");
    await f.session.submit("retry", async () => "valid");
    expect(f.session.target).toBe(target);
    expect(f.session.drafts).toEqual(["valid"]);
  });
  test("detached page A result cannot change page B state", async () => {
    const f = pendingSession(); const b = createPageInlineRewriteSession("page-b");
    b.open({ ...target, sourceBlockIds: ["b"] }); b.setInput("B instruction");
    f.finish("A draft"); await f.pending;
    expect(b.state.input).toBe("B instruction");
    expect(b.state.status).toBe("user-input");
    expect(b.drafts).toEqual([]);
    expect(f.session.drafts).toEqual(["A draft"]);
  });
});
