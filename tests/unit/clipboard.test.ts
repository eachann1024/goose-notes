import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  getEditorSelectionPlainText,
  htmlHasNonDefaultGooseBlockAttrs,
  htmlHasPreservableFormatting,
  normalizeClipboardListMarkers,
  serializeDocRangePlainText,
} from "../../src/components/editor/utils/clipboard";

function findBlockContentRange(editor: BlockNoteEditor, blockId: string) {
  let from = -1;
  let to = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    if (String(node.attrs.id) !== blockId) return true;
    const content = node.firstChild;
    if (!content?.isTextblock) return true;
    from = pos + 2;
    to = from + content.content.size;
    return false;
  });
  if (from < 0) throw new Error(`block ${blockId} not found`);
  return { from, to };
}

function selectRange(editor: BlockNoteEditor, from: number, to: number) {
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, to));
  });
}

function expectSelectionPlainText(
  editor: BlockNoteEditor,
  from: number,
  to: number,
  expected: string,
) {
  selectRange(editor, from, to);
  expect(getEditorSelectionPlainText(editor.prosemirrorState)).toBe(expected);
  expect(serializeDocRangePlainText(editor.prosemirrorState.doc, from, to)).toBe(
    expected,
  );
}

test("多行 checkListItem 复制为单行换行、无多余空格", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "t1",
        type: "checkListItem",
        props: { checked: false },
        content: "Task 1",
      },
      {
        id: "t2",
        type: "checkListItem",
        props: { checked: true },
        content: "Task 2",
      },
      {
        id: "t3",
        type: "checkListItem",
        props: { checked: false },
        content: "Task 3",
      },
    ],
  });
  const first = findBlockContentRange(editor, "t1");
  const last = findBlockContentRange(editor, "t3");
  const doc = editor.prosemirrorState.doc;

  // 默认 PM `\n\n` 会在每个 isBlock 之间插空行，比可见行更脏。
  const dirty = doc.textBetween(first.from, last.to, "\n\n");
  expect(dirty).not.toBe("Task 1\nTask 2\nTask 3");
  expect(dirty.split("\n\n").length).toBeGreaterThan(1);

  expectSelectionPlainText(
    editor,
    first.from,
    last.to,
    "Task 1\nTask 2\nTask 3",
  );
});

test("嵌套 checkListItem 与 bullet 子块复制紧凑", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "parent",
        type: "checkListItem",
        props: { checked: false },
        content: "Parent task",
        children: [
          { id: "child-a", type: "bulletListItem", content: "Child bullet" },
          {
            id: "child-b",
            type: "checkListItem",
            props: { checked: true },
            content: "Nested todo",
          },
        ],
      },
    ],
  });
  const parent = findBlockContentRange(editor, "parent");
  let childBTo = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    if (String(node.attrs.id) !== "child-b") return true;
    const content = node.firstChild;
    if (!content?.isTextblock) return true;
    childBTo = pos + 2 + content.content.size;
    return false;
  });

  expectSelectionPlainText(
    editor,
    parent.from,
    childBTo,
    "Parent task\nChild bullet\nNested todo",
  );
});

test("连续 bullet / numbered / toggleListItem 复制紧凑", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "b1", type: "bulletListItem", content: "Bullet one" },
      { id: "b2", type: "bulletListItem", content: "Bullet two" },
      { id: "n1", type: "numberedListItem", content: "Number one" },
      { id: "n2", type: "numberedListItem", content: "Number two" },
      { id: "g1", type: "toggleListItem", content: "Toggle one" },
      { id: "g2", type: "toggleListItem", content: "Toggle two" },
    ],
  });

  const bulletFrom = findBlockContentRange(editor, "b1").from;
  const bulletTo = findBlockContentRange(editor, "b2").to;
  expectSelectionPlainText(
    editor,
    bulletFrom,
    bulletTo,
    "Bullet one\nBullet two",
  );

  const numberedFrom = findBlockContentRange(editor, "n1").from;
  const numberedTo = findBlockContentRange(editor, "n2").to;
  expectSelectionPlainText(
    editor,
    numberedFrom,
    numberedTo,
    "Number one\nNumber two",
  );

  const toggleFrom = findBlockContentRange(editor, "g1").from;
  const toggleTo = findBlockContentRange(editor, "g2").to;
  expectSelectionPlainText(
    editor,
    toggleFrom,
    toggleTo,
    "Toggle one\nToggle two",
  );
});

test("两个 paragraph 之间保留空行", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "p1", type: "paragraph", content: "Para 1" },
      { id: "p2", type: "paragraph", content: "Para 2" },
    ],
  });
  const first = findBlockContentRange(editor, "p1");
  const second = findBlockContentRange(editor, "p2");
  expectSelectionPlainText(editor, first.from, second.to, "Para 1\n\nPara 2");
});

test("单段落后部分选区只含选中字", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ id: "p1", type: "paragraph", content: "Hello world" }],
  });
  const range = findBlockContentRange(editor, "p1");
  expectSelectionPlainText(editor, range.from + 2, range.from + 7, "llo w");
});

test("代码块内部空白保持原样", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "code",
        type: "codeBlock",
        props: { language: "javascript" },
        content: "line one  \n  line two",
      },
    ],
  });
  let from = -1;
  let to = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return true;
    from = pos + 1;
    to = pos + node.nodeSize - 1;
    return false;
  });
  const text = serializeDocRangePlainText(editor.prosemirrorState.doc, from, to);
  expect(text).toBe("line one  \n  line two");
});

test("复制无序列表使用短横线，保留嵌套、格式、代码与分隔线", () => {
  const source = "* **项目**\n  * 子项\n\n> * 引用列表\n\n+ 项目\n\n1. 有序\n\n***\n\n```md\n* 代码\n```\n\n    * 缩进代码\n\n`* 行内代码`";
  expect(normalizeClipboardListMarkers(source)).toBe(
    "- **项目**\n  - 子项\n\n> - 引用列表\n\n- 项目\n\n1. 有序\n\n***\n\n```md\n* 代码\n```\n\n    * 缩进代码\n\n`* 行内代码`",
  );
});

test("htmlHasNonDefaultGooseBlockAttrs 空 html 为 false", () => {
  expect(htmlHasNonDefaultGooseBlockAttrs("")).toBe(false);
  expect(htmlHasNonDefaultGooseBlockAttrs("   ")).toBe(false);
});

test("htmlHasNonDefaultGooseBlockAttrs 仅非 default 块属性为 true", () => {
  expect(
    htmlHasNonDefaultGooseBlockAttrs(
      '<p data-background-color="#ffeeaa">块背景</p>',
    ),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-color="red">字色</p>'),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-alignment="center">居中</p>'),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-background-color="default">x</p>'),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-color="DEFAULT">x</p>'),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-alignment="left">x</p>'),
  ).toBe(false);
});

test("htmlHasNonDefaultGooseBlockAttrs 不因 strong/span 为 true", () => {
  expect(
    htmlHasNonDefaultGooseBlockAttrs("<p><strong>加粗</strong></p>"),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<span style="color: red">红字</span>'),
  ).toBe(false);
});

test("htmlHasPreservableFormatting 空 html 为 false", () => {
  expect(htmlHasPreservableFormatting("")).toBe(false);
  expect(htmlHasPreservableFormatting("   ")).toBe(false);
});

test("htmlHasPreservableFormatting 识别行内标签", () => {
  expect(htmlHasPreservableFormatting("<p><strong>加粗</strong></p>")).toBe(
    true,
  );
  expect(htmlHasPreservableFormatting("<p><mark>高亮</mark></p>")).toBe(true);
  expect(htmlHasPreservableFormatting("<p>纯文本</p>")).toBe(false);
});

test("htmlHasPreservableFormatting 识别 Goose 块属性与 style 颜色", () => {
  expect(
    htmlHasPreservableFormatting(
      '<p data-background-color="#ffeeaa">块背景</p>',
    ),
  ).toBe(true);
  expect(
    htmlHasPreservableFormatting('<span style="color: red">红字</span>'),
  ).toBe(true);
  expect(
    htmlHasPreservableFormatting(
      '<p style="background-color: yellow">黄底</p>',
    ),
  ).toBe(true);
});

test("htmlHasPreservableFormatting 识别标题与引用", () => {
  expect(htmlHasPreservableFormatting("<h2>标题</h2>")).toBe(true);
  expect(htmlHasPreservableFormatting("<blockquote>引用</blockquote>")).toBe(
    true,
  );
});
