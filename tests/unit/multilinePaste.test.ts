import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  buildInheritedPasteBlocks,
  htmlHasNonTextPasteBlocks,
  inspectPasteContainer,
  planMultilinePaste,
  resolveInheritedPasteBlockType,
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

test("含图片/表格/代码的 HTML 不拆纯文本行", () => {
  expect(htmlHasNonTextPasteBlocks("<p>a</p><img src='x'>")).toBe(true);
  expect(htmlHasNonTextPasteBlocks("<table><tr><td>a</td></tr></table>")).toBe(
    true,
  );
  expect(htmlHasNonTextPasteBlocks("<p>a<br>b</p>")).toBe(false);
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
      htmlText: "",
      inSoftWrap: false,
      inTable: false,
      multiBlockSelection: false,
    }),
  ).toBe(true);
});

test("inspectPasteContainer 识别空待办和引用", () => {
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
