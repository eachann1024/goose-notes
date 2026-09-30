import { expect, test } from "playwright/test";
import {
  explodeAiGeneratedBlocks,
  classifyAiLineText,
} from "../../src/lib/ai-write/explodeAiGeneratedBlocks";
import {
  buildAiPageContent,
  normalizeAiMarkdown,
  normalizeAiMarkdownForDiff,
  parseAiMarkdownToBlocks,
} from "../../src/lib/notebook-ai/markdown";

function plainText(block: { content?: unknown } | undefined): string {
  if (!block) return "";
  const c = block.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c
    .map((item) => {
      if (typeof item === "string") return item;
      return (item as { text?: string })?.text ?? "";
    })
    .join("");
}

test("classify 识别标准任务、emoji 与列表前缀", () => {
  expect(classifyAiLineText("- [x] 已完成")).toEqual({
    kind: "check",
    checked: true,
    rest: "已完成",
    prefixLength: "- [x] ".length,
  });
  expect(classifyAiLineText("✅ 白天不犯困")).toMatchObject({
    kind: "check",
    checked: true,
    rest: "白天不犯困",
  });
  expect(classifyAiLineText("☐ 未完成")).toMatchObject({
    kind: "check",
    checked: false,
    rest: "未完成",
  });
  expect(classifyAiLineText("• 苹果")).toMatchObject({
    kind: "bullet",
    rest: "苹果",
  });
  expect(classifyAiLineText("【x】 全角已完成")).toMatchObject({
    kind: "check",
    checked: true,
    rest: "全角已完成",
  });
  expect(classifyAiLineText("【】 全角未完成")).toMatchObject({
    kind: "check",
    checked: false,
    rest: "全角未完成",
  });
  expect(classifyAiLineText("1.5倍效率")).toBeNull();
  expect(classifyAiLineText("2024.8.28 开始打卡")).toBeNull();
  expect(classifyAiLineText("1. 正规有序")).toMatchObject({
    kind: "numbered",
    start: 1,
    rest: "正规有序",
  });
});

test("落盘会拆相邻正文行，diff 对齐不会", () => {
  const raw = ["第一行", "第二行"].join("\n");
  expect(normalizeAiMarkdown(raw)).toBe("第一行\n\n第二行");
  expect(normalizeAiMarkdownForDiff(raw)).toBe("第一行\n第二行");
});

test("连续普通行解析成独立段落，而不是一个带换行的 block", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["早睡早起真的会发光", "从今晚开始，一起打卡吧"].join("\n"),
  );
  expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  expect(blocks.map((b) => plainText(b))).toEqual([
    "早睡早起真的会发光",
    "从今晚开始，一起打卡吧",
  ]);
});

test("伪待办行落成可勾选的独立 checkListItem", () => {
  const blocks = parseAiMarkdownToBlocks(
    [
      "坚持下来：",
      "✅ 皮肤变透亮，黑眼圈淡了",
      "☑️ 白天不犯困，效率翻倍",
      "☐ 连心情都变好啦",
    ].join("\n"),
  );
  expect(blocks.map((b) => b.type)).toEqual([
    "paragraph",
    "checkListItem",
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks.slice(1).map((b) => (b as { props?: { checked?: boolean } }).props?.checked)).toEqual([
    true,
    true,
    false,
  ]);
  expect(blocks.slice(1).map((b) => plainText(b))).toEqual([
    "皮肤变透亮，黑眼圈淡了",
    "白天不犯困，效率翻倍",
    "连心情都变好啦",
  ]);
});

test("单个段落里的 hardBreak 待办拆成多个 checkListItem", () => {
  const blocks = explodeAiGeneratedBlocks([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "✅ 白天不犯困，效率翻倍\n☑️ 连心情都变好啦", styles: {} },
      ],
    },
  ]);
  expect(blocks).toHaveLength(2);
  expect(blocks.map((b) => b.type)).toEqual([
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks.map((b) => (b as { props?: { checked?: boolean } }).props?.checked)).toEqual([
    true,
    true,
  ]);
});

test("一个 checkListItem 内多行拆成独立待办，checked 为布尔值", () => {
  const blocks = explodeAiGeneratedBlocks([
    {
      type: "checkListItem",
      props: { checked: "true" },
      content: "白天不犯困，效率翻倍\n连心情都变好啦",
    },
  ]);
  expect(blocks).toHaveLength(2);
  expect(blocks.map((b) => b.type)).toEqual([
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks.map((b) => (b as { props?: { checked?: boolean } }).props?.checked)).toEqual([
    true,
    true,
  ]);
  expect(blocks.map((b) => plainText(b))).toEqual([
    "白天不犯困，效率翻倍",
    "连心情都变好啦",
  ]);
});

test("空待办行不会留下占位列表块", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["- [x] 皮肤变透亮", "- [ ]", "- [x] 白天不犯困"].join("\n"),
  );
  expect(blocks.map((b) => b.type)).toEqual([
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks.map((b) => plainText(b))).toEqual(["皮肤变透亮", "白天不犯困"]);
});

test("代码围栏内的待办标记保持原样，不拆成勾选块", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["```text", "✅ 围栏内", "- [x] 也不改", "```"].join("\n"),
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.type).toBe("codeBlock");
  expect(plainText(blocks[0])).toContain("✅ 围栏内");
});

test("全角待办落成可勾选 checkListItem", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["【x】 白天不犯困", "【】 连心情都变好啦"].join("\n"),
  );
  expect(blocks.map((b) => b.type)).toEqual([
    "checkListItem",
    "checkListItem",
  ]);
  expect(blocks.map((b) => (b as { props?: { checked?: boolean } }).props?.checked)).toEqual([
    true,
    false,
  ]);
});

test("小数和日期不会被收成有序列表", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["1.5倍效率", "2024.8.28 开始打卡"].join("\n"),
  );
  expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
  expect(blocks.map((b) => plainText(b))).toEqual([
    "1.5倍效率",
    "2024.8.28 开始打卡",
  ]);
});

test("连续有序列表只在首项保留 start", () => {
  const blocks = parseAiMarkdownToBlocks("2. 第二项\n3. 第三项");
  expect(blocks.map((b) => b.type)).toEqual([
    "numberedListItem",
    "numberedListItem",
  ]);
  expect((blocks[0] as { props?: { start?: number } }).props?.start).toBe(2);
  expect((blocks[1] as { props?: { start?: number } }).props?.start).toBeUndefined();
});

test("callout 多行不拆成多张卡片", () => {
  const blocks = explodeAiGeneratedBlocks([
    {
      type: "callout",
      props: { icon: "💡" },
      content: "第一行\n第二行",
    },
  ]);
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.type).toBe("callout");
  expect(plainText(blocks[0])).toBe("第一行\n第二行");
});

test("波浪围栏内的待办标记保持原样", () => {
  const blocks = parseAiMarkdownToBlocks(
    ["~~~text", "✅ 围栏内", "- [x] 也不改", "~~~"].join("\n"),
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.type).toBe("codeBlock");
  expect(plainText(blocks[0])).toContain("✅ 围栏内");
});

test("加粗前缀的待办也能剥掉标记", () => {
  const blocks = explodeAiGeneratedBlocks([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "✅ 白天不犯困", styles: { bold: true } },
      ],
    },
  ]);
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.type).toBe("checkListItem");
  expect(plainText(blocks[0])).toBe("白天不犯困");
});

test("buildAiPageContent 把作息表每行写成独立段落", () => {
  const content = buildAiPageContent(
    "早睡打卡",
    [
      "⏰ 我的作息表：",
      "6:30 起床，先喝一杯温水",
      "7:00 晨间拉伸 + 散步",
      "23:00 准时入睡",
    ].join("\n"),
  ) as Array<{ type?: string }>;
  const body = content.filter(
    (b) => !(b.type === "heading"),
  );
  // 标题块在前；正文 4 行独立
  expect(content[0]).toMatchObject({ type: "heading" });
  expect(body).toHaveLength(4);
  expect(body.every((b) => b.type === "paragraph")).toBe(true);
});
