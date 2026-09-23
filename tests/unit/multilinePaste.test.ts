import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  buildInheritedPasteBlocks,
  htmlHasNonTextPasteBlocks,
  htmlHasRichPasteContent,
  htmlLooksLikeBlockNoteClipboard,
  htmlToPlainTextForPaste,
  inspectPasteContainer,
  planMultilinePaste,
  resolveInheritedPasteBlockType,
  resolvePasteLines,
  shouldPreferPlainMultilinePaste,
  shouldSplitMultilinePaste,
  splitPlainTextPasteLines,
  stripInheritedListPrefix,
} from "../../src/components/editor/utils/multilinePaste";

function inlineText(block: { content?: unknown }): string {
  const content = block.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

test("没有换行符时不拆块", () => {
  expect(splitPlainTextPasteLines("只有一行")).toBeNull();
  expect(splitPlainTextPasteLines("")).toBeNull();
});

test("多行按换行拆块，丢掉复制带来的末尾空行", () => {
  expect(splitPlainTextPasteLines("甲\n乙\n丙\n")).toEqual(["甲", "乙", "丙"]);
  expect(splitPlainTextPasteLines("甲\r\n乙\r\n丙")).toEqual(["甲", "乙", "丙"]);
});

test("中间空行保留为空块", () => {
  expect(splitPlainTextPasteLines("甲\n\n乙")).toEqual(["甲", "", "乙"]);
});

test("只有一个换行且去掉末尾空行后剩一行 → 不拆", () => {
  expect(splitPlainTextPasteLines("单行\n")).toBeNull();
});

test("列表块继承类型，段落不继承", () => {
  expect(resolveInheritedPasteBlockType("checkListItem")).toBe("checkListItem");
  expect(resolveInheritedPasteBlockType("bulletListItem")).toBe(
    "bulletListItem",
  );
  expect(resolveInheritedPasteBlockType("numberedListItem")).toBe(
    "numberedListItem",
  );
  expect(resolveInheritedPasteBlockType("paragraph")).toBe("paragraph");
  expect(resolveInheritedPasteBlockType("heading")).toBe("paragraph");
});

test("粘进列表时去掉行首项目符号", () => {
  expect(stripInheritedListPrefix("- 销售数据")).toBe("销售数据");
  expect(stripInheritedListPrefix("1. 定时任务")).toBe("定时任务");
  expect(stripInheritedListPrefix("[ ] 待办")).toBe("待办");
  expect(stripInheritedListPrefix("- [x] 已做")).toBe("已做");
  expect(stripInheritedListPrefix("普通一行")).toBe("普通一行");
});

test("待办多行计划：首行就地写入，其余都是未勾选待办", () => {
  const plan = planMultilinePaste(
    [
      "AI Agent 支持定时任务",
      "销售数据的信息发个给我",
      "定时任务管理界面",
    ],
    "checkListItem",
  );
  expect(plan.firstLine).toBe("AI Agent 支持定时任务");
  expect(plan.restBlocks).toEqual([
    {
      type: "checkListItem",
      content: "销售数据的信息发个给我",
      props: { checked: false },
    },
    {
      type: "checkListItem",
      content: "定时任务管理界面",
      props: { checked: false },
    },
  ]);
});

test("段落多行计划：其余都是段落", () => {
  const blocks = buildInheritedPasteBlocks(["二", "三"], "paragraph");
  expect(blocks).toEqual([
    { type: "paragraph", content: "二" },
    { type: "paragraph", content: "三" },
  ]);
});

test("表格/代码 HTML 不拆纯文本行，表情图片不挡拆行", () => {
  expect(htmlHasNonTextPasteBlocks("<p>a</p><img src='x'>")).toBe(false);
  expect(htmlHasNonTextPasteBlocks("<table><tr><td>a</td></tr></table>")).toBe(
    true,
  );
  expect(htmlHasNonTextPasteBlocks("<pre>code</pre>")).toBe(true);
  expect(htmlHasNonTextPasteBlocks("<p>a<br>b</p>")).toBe(false);
});

test("多行带可保留格式 HTML 不按纯文本拆行", () => {
  const lines = ["甲", "乙"];
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "<p><strong>甲</strong><br><strong>乙</strong></p>",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(false);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: '<p data-background-color="#ffeeaa">甲<br>乙</p>',
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(false);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: '<p data-background-color="default">甲<br>乙</p>',
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(true);
});

test("BlockNote 内部列表 HTML 不按纯文本拆行", () => {
  const html =
    '<div data-node-type="blockContainer"><div data-content-type="numberedListItem">123</div></div><div data-node-type="blockContainer"><div data-content-type="numberedListItem">333</div></div>';
  expect(htmlLooksLikeBlockNoteClipboard(html)).toBe(true);
  expect(htmlHasRichPasteContent(html)).toBe(true);
  expect(
    shouldSplitMultilinePaste({
      lines: ["123", "333"],
      htmlText: html,
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(false);
});

test("多行无格式 HTML 仍按纯文本拆行", () => {
  const lines = ["甲", "乙"];
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "<p>甲<br>乙</p>",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(true);
});

test("Markdown 混合格式不按纯文本拆行，有 alt 的正文图片也保留", () => {
  expect(shouldSplitMultilinePaste({
    lines: ["**SAPI**", "", "- [ ] 任务", "![image.png](data:image/png;base64,AAAA)"],
    htmlText: "", inSoftWrap: false, inTable: false, multiBlockSelection: false,
  })).toBe(false);
  expect(htmlHasRichPasteContent('<p>图片</p><img alt="image.png" src="data:image/png;base64,AAAA">')).toBe(true);
  expect(htmlHasRichPasteContent('<p>图标<img alt="🔥" src="https://res.wx.qq.com/emoji.gif"></p>')).toBe(false);
});

test("callout / 表格 / 跨块选区不拆", () => {
  const lines = ["一", "二"];
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "",
      inSoftWrap: true,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(false);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "",
      inSoftWrap: false,
      inTable: true,
      multiBlockSelection: false,
    }),
  ).toBe(false);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: true,
    }),
  ).toBe(false);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "<p>甲<br>乙<img alt='🔥' src='https://res.wx.qq.com/emoji.gif'></p>",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(true);
});

test("inspectPasteContainer 识别空待办、引用和标注", () => {
  const emptyTodo = inspectPasteContainer({
    depth: 2,
    node: (d) => {
      if (d === 1) {
        return { type: { name: "blockContainer" }, content: { size: 1 } };
      }
      return { type: { name: "checkListItem" }, content: { size: 0 } };
    },
  });
  expect(emptyTodo.listType).toBe("checkListItem");
  expect(emptyTodo.listEmpty).toBe(true);

  const quote = inspectPasteContainer({
    depth: 2,
    node: (d) => {
      if (d === 1) {
        return { type: { name: "blockContainer" }, content: { size: 1 } };
      }
      return { type: { name: "quote" }, content: { size: 4 } };
    },
  });
  expect(quote.inSoftWrap).toBe(true);
  expect(quote.listType).toBeNull();

  const callout = inspectPasteContainer({
    depth: 2,
    node: (d) => {
      if (d === 1) {
        return { type: { name: "blockContainer" }, content: { size: 1 } };
      }
      return { type: { name: "callout" }, content: { size: 4 } };
    },
  });
  expect(callout.inSoftWrap).toBe(true);
  expect(callout.listType).toBeNull();
});

test("空待办按计划插入后变成多条未勾选待办", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ id: "todo", type: "checkListItem", content: "" }],
  });
  const plan = planMultilinePaste(
    ["AI Agent 支持定时任务", "销售数据的信息发个给我", "定时任务管理界面"],
    "checkListItem",
  );
  editor.updateBlock("todo", { content: plan.firstLine });
  editor.insertBlocks(plan.restBlocks, "todo", "after");
  const rows = editor.document.map((block) => ({
    type: block.type,
    text: inlineText(block),
    checked: (block.props as { checked?: boolean } | undefined)?.checked,
  }));
  expect(rows).toEqual([
    {
      type: "checkListItem",
      text: "AI Agent 支持定时任务",
      checked: false,
    },
    {
      type: "checkListItem",
      text: "销售数据的信息发个给我",
      checked: false,
    },
    {
      type: "checkListItem",
      text: "定时任务管理界面",
      checked: false,
    },
  ]);
});

const PI_POST = `玩 Pi，我发现很多人装了一堆插件，写代码还是乱🔥

上次我分享了Pi常用的插件组合，推荐了联网的、远程控制和安全防护相关的，反响非常好，今天我分享一些特别的插件。

这次不推能连网的插件，我只推我反复用在写代码上插件。

1、ponytail
先复用现有代码，少生成一堆新文件。
Pi 默认很能写，但最浪费时间的不是写不出来，是写了一堆你事后还要删的东西。`;

test("长文按行拆块，空行保留为空块", () => {
  const lines = splitPlainTextPasteLines(PI_POST);
  expect(lines?.[0]).toBe("玩 Pi，我发现很多人装了一堆插件，写代码还是乱🔥");
  expect(lines?.[1]).toBe("");
  expect(lines?.[6]).toBe("1、ponytail");
  expect(lines?.length).toBeGreaterThan(6);
  expect(
    shouldSplitMultilinePaste({
      lines,
      htmlText: "",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(true);
});

test("纯文本无换行时从 HTML 的 br/p 找回每一行", () => {
  const jammed =
    "玩 Pi，我发现很多人装了一堆插件，写代码还是乱🔥上次我分享了Pi常用的插件组合";
  const html = `<p>玩 Pi，我发现很多人装了一堆插件，写代码还是乱<img alt="🔥" src="https://res.wx.qq.com/emoji.gif"><br><br>上次我分享了Pi常用的插件组合</p>`;
  expect(splitPlainTextPasteLines(jammed)).toBeNull();
  expect(htmlToPlainTextForPaste(html)).toContain("🔥");
  expect(resolvePasteLines(jammed, html)).toEqual([
    "玩 Pi，我发现很多人装了一堆插件，写代码还是乱🔥",
    "",
    "上次我分享了Pi常用的插件组合",
  ]);
});

test("富文本没写入原文换行时回退纯文本，已有段落或结构时保留 HTML", () => {
  const plain = "第一段\n\n第二段\n第三行";
  expect(shouldPreferPlainMultilinePaste(plain, '<div style="white-space:pre-wrap"><strong>第一段\n\n第二段\n第三行</strong></div>')).toBe(true);
  expect(shouldPreferPlainMultilinePaste(plain, '<p><strong>第一段</strong></p><p>第二段</p><p>第三行</p>')).toBe(false);
  expect(shouldPreferPlainMultilinePaste(plain, '<p>第一段<br><br>第二段<br>第三行</p>')).toBe(false);
  expect(shouldPreferPlainMultilinePaste(plain, '<table><tr><td>第一段</td></tr></table>')).toBe(false);
});

test("Unicode 行分隔符也按行拆", () => {
  expect(splitPlainTextPasteLines("甲\u2028乙\u2029丙")).toEqual([
    "甲",
    "乙",
    "丙",
  ]);
});

test("段落多行计划：中文编号每一行一块", () => {
  const plan = planMultilinePaste(
    ["1、ponytail", "先复用现有代码，少生成一堆新文件。"],
    "paragraph",
  );
  expect(plan.firstLine).toBe("1、ponytail");
  expect(plan.restBlocks).toEqual([
    { type: "paragraph", content: "先复用现有代码，少生成一堆新文件。" },
  ]);
});

test("长文插入后每一行一个段落块", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ id: "p", type: "paragraph", content: "" }],
  });
  const lines = splitPlainTextPasteLines(PI_POST)!;
  const plan = planMultilinePaste(lines, "paragraph");
  editor.updateBlock("p", { content: plan.firstLine });
  editor.insertBlocks(plan.restBlocks, "p", "after");
  const texts = editor.document.map((block) => inlineText(block));
  expect(texts[0]).toBe("玩 Pi，我发现很多人装了一堆插件，写代码还是乱🔥");
  expect(texts).toContain("1、ponytail");
  expect(texts).toContain("先复用现有代码，少生成一堆新文件。");
  expect(texts.length).toBe(lines.length);
});
