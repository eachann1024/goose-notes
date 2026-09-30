import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, test } from "playwright/test";
import { commitPendingEditorChange } from "../../src/components/editor/core/editorPendingCommit";

// ponytail: 隔离执行真实源码回调，不挂载 React/BlockNote；生命周期集成由桌面验收覆盖。
const editorSource = ts.createSourceFile(
  "Editor.tsx",
  readFileSync("src/components/editor/core/Editor.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let commitCallback: string | undefined;
const findCommitCallback = (node: ts.Node): void => {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(editorSource) === "commitEditorContent" &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    commitCallback = node.initializer.arguments[0].getText(editorSource);
  }
  ts.forEachChild(node, findCommitCallback);
};
findCommitCallback(editorSource);
if (!commitCallback) throw new Error("找不到 Editor.commitEditorContent 回调");
const callbackJavaScript = ts.transpile(`const extractedFlush = (${commitCallback});`, {
  target: ts.ScriptTarget.ES2022,
});

for (const scenario of [
  { name: "无 pending", pending: false, target: undefined, signature: "latest", reads: 0, writes: 0, finalPending: false },
  { name: "旧页", pending: true, target: "page-old", signature: "latest", reads: 0, writes: 0, finalPending: true },
  { name: "当前页 pending", pending: true, target: undefined, signature: "latest", reads: 1, writes: 1, finalPending: false },
  { name: "内容未变", pending: true, target: undefined, signature: "synced", reads: 1, writes: 0, finalPending: false },
]) {
  test(`Editor flush 回调：${scenario.name}`, () => {
    const calls: string[] = [];
    const pending = { current: scenario.pending };
    const synced = { current: "synced" };
    const committed: string[] = [];
    const flush = new Function(
      "pageIdForUpdateRef", "pendingEditorChangeRef", "debouncedUpdate",
      "readCurrentEditorContent", "commitPendingEditorChange",
      "syncedContentSignatureRef", "onContentChangeRef",
      `${callbackJavaScript}\nreturn extractedFlush;`,
    )(
      { current: "page-current" }, pending,
      { cancel: () => calls.push("cancel") },
      () => {
        calls.push("read");
        return { content: "latest", signature: scenario.signature };
      },
      commitPendingEditorChange, synced,
      { current: (content: string) => committed.push(content) },
    ) as (targetPageId?: string) => void;

    expect(typeof flush, "提取的 Editor.commitEditorContent 应为函数").toBe("function");
    flush(scenario.target);
    expect(calls).toEqual(scenario.reads ? ["cancel", "read"] : ["cancel"]);
    expect(committed).toEqual(scenario.writes ? ["latest"] : []);
    expect(pending.current).toBe(scenario.finalPending);
    expect(synced.current).toBe(scenario.writes ? scenario.signature : "synced");
    flush(scenario.target);
    expect(calls.at(-1)).toBe("cancel");
    expect(calls.filter((call) => call === "read")).toHaveLength(scenario.reads);
    expect(committed).toHaveLength(scenario.writes);
  });
}

test("卸载提交 pending 内容且重复调用不会重复写入", () => {
  const committed: string[] = [];
  let pending = true;
  const run = () => {
    const result = commitPendingEditorChange({
      targetPageId: "page-a",
      currentPageId: "page-a",
      pending,
      content: "latest",
      signature: "sig-latest",
      syncedSignature: "sig-old",
      commit: (value) => committed.push(value),
    });
    if (result === "committed") pending = false;
    return result;
  };

  expect(run()).toBe("committed");
  expect(run()).toBe("not-pending");
  expect(committed).toEqual(["latest"]);
});

test("旧页面卸载不能把内容提交到新页面", () => {
  const committed: string[] = [];
  expect(
    commitPendingEditorChange({
      targetPageId: "page-a",
      currentPageId: "page-b",
      pending: true,
      content: "stale",
      signature: "stale",
      syncedSignature: "old",
      commit: (value) => committed.push(value),
    }),
  ).toBe("stale-page");
  expect(committed).toEqual([]);
});
