import type { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { locateAndHighlight } from "../../src/components/editor/find/searchHighlightLocate";

type TimerTask = { callback: () => void; cleared: boolean };

function withQueuedTimers(run: (tasks: TimerTask[]) => void) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const tasks: TimerTask[] = [];

  globalThis.setTimeout = ((callback: TimerHandler) => {
    const task = {
      callback: () => {
        if (typeof callback === "function") callback();
      },
      cleared: false,
    };
    tasks.push(task);
    return task as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((task: ReturnType<typeof setTimeout>) => {
    (task as unknown as TimerTask).cleared = true;
  }) as typeof clearTimeout;

  try {
    run(tasks);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

function withNoMatchTreeWalker(run: () => void) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const nodeFilterDescriptor = Object.getOwnPropertyDescriptor(globalThis, "NodeFilter");

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createTreeWalker: () => ({ nextNode: () => null }),
    },
  });
  Object.defineProperty(globalThis, "NodeFilter", {
    configurable: true,
    value: { SHOW_TEXT: 4 },
  });

  try {
    run();
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
    if (nodeFilterDescriptor) Object.defineProperty(globalThis, "NodeFilter", nodeFilterDescriptor);
    else Reflect.deleteProperty(globalThis, "NodeFilter");
  }
}

test("搜索定位的延迟任务在编辑器卸载后停止，挂载时仍会写入高亮", () => {
  let mounted = true;
  let domReads = 0;
  let dispatches = 0;
  const root = {
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  const view = {
    state: { tr: { setMeta: () => ({}) } },
    dispatch: () => {
      dispatches += 1;
    },
  } as Record<string, unknown>;
  Object.defineProperty(view, "dom", {
    get() {
      domReads += 1;
      if (!mounted) throw new Error("destroyed editor view must not expose dom");
      return root;
    },
  });

  const editor = {
    _tiptapEditor: {
      get isDestroyed() {
        return !mounted;
      },
    },
    get prosemirrorView() {
      return view;
    },
  } as unknown as BlockNoteEditor<any, any, any>;

  withNoMatchTreeWalker(() => {
    withQueuedTimers((tasks) => {
      locateAndHighlight(editor, "Cross Target");

      // 已挂载的首次定位仍会写入 find plugin，并安排滚动与淡出。
      expect(dispatches).toBe(1);
      expect(domReads).toBe(1);
      expect(tasks).toHaveLength(2);

      // 模拟跨库切换导致旧 EditorView 在延迟任务执行前卸载。
      mounted = false;
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (task && !task.cleared) task.callback();
      }

      // 卸载后的回调被生命周期 guard 取消，没有再次读取已销毁 view.dom。
      expect(domReads).toBe(1);
    });
  });
});
