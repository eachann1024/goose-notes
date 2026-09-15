import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { installExportDom } from "./installExportDom";
import {
  AI_PANEL_ACTIVE_ATTR,
  appendSelectionQuoteToDom,
  buildSelectionQuoteAttrs,
  canShowAddToChatButton,
  consumePendingAppendComposerSelections,
  dispatchAppendComposerSelection,
  FOCUS_AI_COMPOSER_EVENT,
  formatSelectionQuoteModelBlock,
  hashSelectionQuoteText,
  hasDuplicateSelectionQuote,
  OPEN_AI_PANEL_EVENT,
  shouldDeferPendingSelectionQuote,
  summarizeSelectionQuote,
  takePendingAppendComposerSelections,
} from "../../src/components/editor/ai/composer/selectionQuote";
import { buildPayloadFromTokens, isComposerPayloadEmpty } from "../../src/components/editor/ai/composer/composerTokens";
import { serializeAiComposerDoc } from "../../src/components/editor/ai/composer/referenceLookup";

const quoteAttrs = buildSelectionQuoteAttrs({
  pageId: "page-1",
  pageTitle: "演示笔记",
  text: "这是一段需要送给模型的完整选区原文，不能只剩摘要。",
})!;

function stubWindowDispatch() {
  const events: Array<{ type: string; detail: unknown }> = [];
  const original = window.dispatchEvent;
  window.dispatchEvent = ((event: Event) => {
    events.push({
      type: event.type,
      detail: (event as CustomEvent).detail,
    });
    return true;
  }) as typeof window.dispatchEvent;
  return {
    events,
    restore() {
      window.dispatchEvent = original;
    },
  };
}

test("门控：AI 关闭、空选区、空白、图片 NodeSelection 都不显示；侧栏关闭仍显示", () => {
  expect(
    canShowAddToChatButton({
      aiEnabled: true,
      isCompact: false,
      selectedText: "有字",
      isImageNodeSelection: false,
    }),
  ).toBe(true);
  expect(
    canShowAddToChatButton({
      aiEnabled: false,
      isCompact: false,
      selectedText: "有字",
      isImageNodeSelection: false,
    }),
  ).toBe(false);
  expect(
    canShowAddToChatButton({
      aiEnabled: true,
      isCompact: true,
      selectedText: "有字",
      isImageNodeSelection: false,
    }),
  ).toBe(false);
  expect(
    canShowAddToChatButton({
      aiEnabled: true,
      isCompact: false,
      selectedText: "",
      isImageNodeSelection: false,
    }),
  ).toBe(false);
  expect(
    canShowAddToChatButton({
      aiEnabled: true,
      isCompact: false,
      selectedText: "   \n\t  ",
      isImageNodeSelection: false,
    }),
  ).toBe(false);
  expect(
    canShowAddToChatButton({
      aiEnabled: true,
      isCompact: false,
      selectedText: "有字",
      isImageNodeSelection: true,
    }),
  ).toBe(false);
});

test("桌面小窗草稿页按运行时页面隐藏加入对话，不依赖 compact 构建旗标", () => {
  const toolbar = readFileSync(
    "src/components/editor/toolbars/formatting/index.tsx",
    "utf8",
  );
  expect(toolbar).toContain("isQuickNoteEditorPage(page)");
  expect(toolbar).toContain("isCompact: isQuickNoteSurface");
  expect(toolbar).toContain("!isQuickNoteSurface");
  const composer = readFileSync(
    "src/components/editor/core/EditorComposer.tsx",
    "utf8",
  );
  expect(composer).toContain("if (isQuickNoteEditorPage(page)) return;");
  expect(composer).not.toContain('showDesktopMainWindow("ai-panel")');
  expect(composer).toContain(
    "__GOOSE_LITE__ || isQuickNoteEditorPage(page) ? null",
  );
  expect(composer).toContain("!isQuickNoteEditorPage(page) && (");
  const editor = readFileSync("src/components/editor/core/Editor.tsx", "utf8");
  expect(editor).toContain("{ compact: isQuickNoteEditorPage(page) }");
  expect(editor).not.toContain("rewriteQuickNoteSlashItemForMainWindow");
});

test("侧栏关闭时排队选区并打开并排侧栏，随后聚焦输入框", () => {
  installExportDom();
  document.body.removeAttribute(AI_PANEL_ACTIVE_ATTR);
  takePendingAppendComposerSelections();
  const stub = stubWindowDispatch();
  try {
    dispatchAppendComposerSelection({
      pageId: "page-1",
      pageTitle: "演示笔记",
      text: "选区原文",
      animate: true,
    });
    expect(
      stub.events.filter((event) => event.type === OPEN_AI_PANEL_EVENT),
    ).toEqual([{ type: OPEN_AI_PANEL_EVENT, detail: { layout: "side-panel" } }]);
    expect(
      stub.events.filter((event) => event.type === FOCUS_AI_COMPOSER_EVENT),
    ).toEqual([{ type: FOCUS_AI_COMPOSER_EVENT, detail: null }]);
    expect(takePendingAppendComposerSelections()).toEqual([
      {
        pageId: "page-1",
        pageTitle: "演示笔记",
        text: "选区原文",
        animate: true,
      },
    ]);
    expect(takePendingAppendComposerSelections()).toEqual([]);
  } finally {
    stub.restore();
    takePendingAppendComposerSelections();
  }
});

test("侧栏已开时仍派发打开与聚焦，不强制改布局", () => {
  installExportDom();
  document.body.setAttribute(AI_PANEL_ACTIVE_ATTR, "");
  takePendingAppendComposerSelections();
  const stub = stubWindowDispatch();
  try {
    dispatchAppendComposerSelection({
      pageId: "page-1",
      pageTitle: "演示笔记",
      text: "选区原文",
    });
    expect(
      stub.events.filter((event) => event.type === OPEN_AI_PANEL_EVENT),
    ).toEqual([{ type: OPEN_AI_PANEL_EVENT, detail: null }]);
    expect(
      stub.events.filter((event) => event.type === FOCUS_AI_COMPOSER_EVENT),
    ).toEqual([{ type: FOCUS_AI_COMPOSER_EVENT, detail: null }]);
    expect(takePendingAppendComposerSelections()).toHaveLength(1);
  } finally {
    document.body.removeAttribute(AI_PANEL_ACTIVE_ATTR);
    stub.restore();
    takePendingAppendComposerSelections();
  }
});

test("会话正在切换时推迟消费选区队列", () => {
  expect(
    shouldDeferPendingSelectionQuote({
      composerConversationId: "old",
      activeConversationId: "new",
    }),
  ).toBe(true);
  expect(
    shouldDeferPendingSelectionQuote({
      composerConversationId: "same",
      activeConversationId: "same",
    }),
  ).toBe(false);
  expect(
    shouldDeferPendingSelectionQuote({
      composerConversationId: "old",
      activeConversationId: null,
    }),
  ).toBe(false);
});

test("消费失败时选区留在队列，成功后才出队", () => {
  installExportDom();
  document.body.removeAttribute(AI_PANEL_ACTIVE_ATTR);
  takePendingAppendComposerSelections();
  const stub = stubWindowDispatch();
  try {
    dispatchAppendComposerSelection({
      pageId: "page-1",
      pageTitle: "演示笔记",
      text: "选区原文",
    });
    expect(consumePendingAppendComposerSelections(() => false)).toBe(1);
    expect(consumePendingAppendComposerSelections(() => true)).toBe(0);
    expect(takePendingAppendComposerSelections()).toEqual([]);
  } finally {
    stub.restore();
    takePendingAppendComposerSelections();
  }
});

test("摘要约 12–18 字并加省略号，全文仍进 hash", () => {
  expect(summarizeSelectionQuote("短句")).toBe("短句");
  expect(
    summarizeSelectionQuote("一二三四五六七八九十abcdefghij"),
  ).toBe("一二三四五六七八九十abcdef…");
  expect(hashSelectionQuoteText("hello")).toBe(
    hashSelectionQuoteText("hello"),
  );
  expect(hashSelectionQuoteText("hello")).not.toBe(
    hashSelectionQuoteText("world"),
  );
});

test("静默 append：不 focus、不覆盖已有文本、chip 在末尾", () => {
  installExportDom();
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.appendChild(document.createTextNode("已有提问 "));
  document.body.appendChild(editor);

  let focused = false;
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function focusMock() {
    focused = true;
  };

  try {
    const result = appendSelectionQuoteToDom(editor, quoteAttrs, {
      animate: true,
      restoreCaret: false,
    });
    expect(result).toBe("appended");
    expect(focused).toBe(false);
    expect(editor.textContent).toContain("已有提问");
    expect(editor.textContent).toContain(summarizeSelectionQuote(quoteAttrs.text));
    const chip = editor.querySelector("[data-ai-selection-quote-attrs]");
    expect(chip).toBeTruthy();
    expect(editor.lastElementChild).toBe(chip);
    expect(chip?.getAttribute("data-ai-selection-quote-enter")).toBe("");
  } finally {
    HTMLElement.prototype.focus = originalFocus;
    editor.remove();
  }
});

test("composer 内正在输入时 caret 恢复到插入前", () => {
  installExportDom();
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  const typed = document.createTextNode("abc");
  editor.appendChild(typed);
  document.body.appendChild(editor);

  let collapsed: { node: Node; offset: number } | null = null;
  const fakeSelection = {
    anchorNode: typed,
    anchorOffset: 2,
    collapse(node: Node, offset: number) {
      collapsed = { node, offset };
      fakeSelection.anchorNode = node;
      fakeSelection.anchorOffset = offset;
    },
  };
  const originalGetSelection = window.getSelection;
  window.getSelection = () => fakeSelection as unknown as Selection;

  try {
    const result = appendSelectionQuoteToDom(editor, quoteAttrs, {
      animate: false,
      restoreCaret: true,
    });
    expect(result).toBe("appended");
    expect(collapsed).toEqual({ node: typed, offset: 2 });
    expect(editor.querySelector("[data-ai-selection-quote-enter]")).toBeNull();
    expect(editor.textContent).toContain("abc");
  } finally {
    window.getSelection = originalGetSelection;
    editor.remove();
  }
});

test("同一 pageId + 文本 hash 去重，不插第二个", () => {
  installExportDom();
  const editor = document.createElement("div");
  document.body.appendChild(editor);
  expect(appendSelectionQuoteToDom(editor, quoteAttrs)).toBe("appended");
  expect(appendSelectionQuoteToDom(editor, quoteAttrs)).toBe("duplicate");
  expect(
    editor.querySelectorAll("[data-ai-selection-quote-attrs]").length,
  ).toBe(1);

  const otherPage = buildSelectionQuoteAttrs({
    pageId: "page-2",
    pageTitle: "另一页",
    text: quoteAttrs.text,
  })!;
  expect(appendSelectionQuoteToDom(editor, otherPage)).toBe("appended");
  expect(
    hasDuplicateSelectionQuote(
      [quoteAttrs],
      { pageId: quoteAttrs.pageId, textHash: quoteAttrs.textHash },
    ),
  ).toBe(true);
  editor.remove();
});

test("序列化 payload 含完整选区文本和来源页标题", () => {
  const payload = buildPayloadFromTokens([
    { type: "text", text: "请解释这段：" },
    { type: "selectionQuote", quote: quoteAttrs },
  ]);
  expect(payload.selectionQuotes).toEqual([quoteAttrs]);
  expect(payload.promptText).toContain(summarizeSelectionQuote(quoteAttrs.text));
  const modelBlock = formatSelectionQuoteModelBlock(payload.selectionQuotes ?? []);
  expect(modelBlock).toContain("这是一段需要送给模型的完整选区原文，不能只剩摘要。");
  expect(modelBlock).toContain("来源页：演示笔记");

  const serialized = serializeAiComposerDoc({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "aiSelectionQuote", attrs: quoteAttrs }],
      },
    ],
  });
  expect(serialized.selectionQuotes?.[0]?.text).toBe(quoteAttrs.text);
  expect(serialized.tokens.some((token) => token.type === "selectionQuote")).toBe(
    true,
  );
  expect(
    isComposerPayloadEmpty({
      promptText: "",
      references: [],
      images: [],
      skills: [],
      selectionQuotes: [quoteAttrs],
    }),
  ).toBe(false);
});
