import { BlockNoteEditor } from "@blocknote/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "prosemirror-tables";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  getCurrentBlockNodeSelection,
  resolveCopyBlockSelection,
  shouldCopyClipboardWithFormatting,
} from "../../src/components/editor/extensions/copyCurrentBlockExtension";
import { isWholeTableCellSelection } from "../../src/components/editor/utils/selection";

function createEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "heading",
        type: "heading",
        props: { level: 2, backgroundColor: "blue" },
        content: "可复制标题",
      },
      { id: "body", type: "paragraph", content: "正文" },
    ],
  });
}

function findFirstTextRange(editor: BlockNoteEditor) {
  let from = -1;
  let to = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (from < 0 && node.isText) {
      from = pos;
      to = pos + node.nodeSize;
    }
    return from < 0;
  });
  return { from, to };
}

function findBlockContainerPos(
  editor: BlockNoteEditor,
  blockId: string,
): number {
  let blockPos = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (blockPos < 0 && node.type.name === "blockContainer") {
      if (String(node.attrs.id) === blockId) blockPos = pos;
    }
    return blockPos < 0;
  });
  if (blockPos < 0) throw new Error(`blockContainer ${blockId} not found`);
  return blockPos;
}

test("getCurrentBlockNodeSelection 在折叠光标时仍可解析当前块", () => {
  const editor = createEditor();
  const selection = getCurrentBlockNodeSelection(editor.prosemirrorState);

  expect(selection?.node.type.name).toBe("blockContainer");
  expect(selection?.node.firstChild?.type.name).toBe("heading");
  expect(selection?.node.firstChild?.attrs.backgroundColor).toBe("blue");
});

test("已有文本选区时 getCurrentBlockNodeSelection 返回 null", () => {
  const editor = createEditor();
  const { from } = findFirstTextRange(editor);
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, from + 2));
  });

  expect(getCurrentBlockNodeSelection(editor.prosemirrorState)).toBeNull();
});

test("折叠光标时 resolveCopyBlockSelection 返回当前块", () => {
  const editor = createEditor();
  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  const current = getCurrentBlockNodeSelection(editor.prosemirrorState);

  expect(resolved).toBeInstanceOf(NodeSelection);
  expect(current).toBeInstanceOf(NodeSelection);
  expect((resolved as NodeSelection).node.attrs.id).toBe(
    (current as NodeSelection).node.attrs.id,
  );
  expect((resolved as NodeSelection).node.firstChild?.type.name).toBe(
    "heading",
  );
});

test("部分文本选区时 resolveCopyBlockSelection 返回 null", () => {
  const editor = createEditor();
  const { from } = findFirstTextRange(editor);
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, from + 2));
  });

  expect(resolveCopyBlockSelection(editor.prosemirrorState)).toBeNull();
});

test("显式 blockContainer NodeSelection 时 resolveCopyBlockSelection 返回该选区", () => {
  const editor = createEditor();
  const blockPos = findBlockContainerPos(editor, "heading");
  editor.transact((tr) => {
    tr.setSelection(NodeSelection.create(tr.doc, blockPos));
  });

  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  expect(resolved).toBeInstanceOf(NodeSelection);
  expect((resolved as NodeSelection).node.type.name).toBe("blockContainer");
  expect((resolved as NodeSelection).node.attrs.id).toBe("heading");
});

test("完整覆盖单块正文时 resolveCopyBlockSelection 返回 NodeSelection", () => {
  const editor = createEditor();
  const blockPos = findBlockContainerPos(editor, "heading");
  const contentNode = editor.prosemirrorState.doc.nodeAt(blockPos + 1);
  expect(contentNode?.isTextblock).toBe(true);
  const contentFrom = blockPos + 2;
  const contentTo = contentFrom + (contentNode?.content.size ?? 0);

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, contentFrom, contentTo));
  });

  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  expect(resolved).toBeInstanceOf(NodeSelection);
  expect((resolved as NodeSelection).node.attrs.id).toBe("heading");
});

test("完整覆盖多块正文时 resolveCopyBlockSelection 返回 Slice", () => {
  const editor = createEditor();
  let headingFrom = -1;
  let bodyTo = -1;

  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    const content = node.firstChild;
    if (!content?.isTextblock) return true;
    const from = pos + 2;
    const to = from + content.content.size;
    if (String(node.attrs.id) === "heading") {
      headingFrom = from;
    } else if (String(node.attrs.id) === "body") {
      bodyTo = to;
    }
    return true;
  });

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, headingFrom, bodyTo));
  });

  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  expect(resolved).not.toBeInstanceOf(NodeSelection);
  expect(resolved?.content.childCount).toBe(2);
  expect(resolved?.content.firstChild?.attrs.id).toBe("heading");
  expect(resolved?.content.lastChild?.attrs.id).toBe("body");
});

test("跨选区命中待办及子图片时，Slice 只保留父块一次", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "复制粘贴测试" },
      {
        id: "task",
        type: "checkListItem",
        props: { checked: true },
        content: "父待办",
        children: [{
          id: "task-image",
          type: "image",
          props: {
            url: "data:image/png;base64,AAAA",
            previewWidth: 286,
          },
        }],
      },
      { id: "tail", type: "paragraph", content: "尾块" },
    ],
  });
  const taskPos = findBlockContainerPos(editor, "task");
  const tailPos = findBlockContainerPos(editor, "tail");
  const tailContent = editor.prosemirrorState.doc.nodeAt(tailPos + 1);
  const from = taskPos + 2;
  const to = tailPos + 2 + (tailContent?.content.size ?? 0);

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, to));
  });

  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  expect(resolved).not.toBeInstanceOf(NodeSelection);
  expect(resolved?.content.childCount).toBe(2);
  expect(resolved?.content.firstChild?.attrs.id).toBe("task");
  expect(resolved?.content.firstChild?.lastChild?.type.name).toBe("blockGroup");
  expect(resolved?.content.firstChild?.lastChild?.firstChild?.attrs.id).toBe(
    "task-image",
  );
  expect(resolved?.content.lastChild?.attrs.id).toBe("tail");
});

function findBlockTextRange(editor: BlockNoteEditor, blockId: string) {
  const blockPos = findBlockContainerPos(editor, blockId);
  const contentNode = editor.prosemirrorState.doc.nodeAt(blockPos + 1);
  if (!contentNode?.isTextblock) {
    throw new Error(`block ${blockId} is not a textblock`);
  }
  const from = blockPos + 2;
  return { from, to: from + contentNode.content.size };
}

test("单行或部分选区复制不带格式", () => {
  const editor = createEditor();
  const { from } = findFirstTextRange(editor);
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, from + 2));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );

  const heading = findBlockTextRange(editor, "heading");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, heading.from, heading.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );
});

test("同一块内多行复制不带格式", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "heading",
        type: "heading",
        content: "标题",
      },
      {
        id: "multi",
        type: "paragraph",
        content: [
          { type: "text", text: "第一行", styles: { bold: true } },
          { type: "text", text: "\n第二行" },
        ],
      },
    ],
  });
  const range = findBlockTextRange(editor, "multi");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );
});

test("跨多个块复制带原格式", () => {
  const editor = createEditor();
  const headingRange = findBlockTextRange(editor, "heading");
  const body = findBlockTextRange(editor, "body");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, headingRange.from, body.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);
});

test("折叠光标在带 children 的块上视为多块，要带格式", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "复制粘贴测试" },
      {
        id: "parent",
        type: "numberedListItem",
        content: "图片增强",
        children: [
          { id: "c1", type: "numberedListItem", content: "光标展示图片" },
          { id: "c2", type: "numberedListItem", content: "点击打开图片" },
        ],
      },
    ],
  });

  const parentRange = findBlockTextRange(editor, "parent");
  editor.transact((tr) => {
    tr.setSelection(
      TextSelection.create(tr.doc, parentRange.from, parentRange.from),
    );
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);

  editor.transact((tr) => {
    tr.setSelection(
      TextSelection.create(tr.doc, parentRange.from, parentRange.to),
    );
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );

  const child = findBlockTextRange(editor, "c2");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, parentRange.from, child.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);
});

function selectBlockContainer(editor: BlockNoteEditor, blockId: string) {
  const pos = findBlockContainerPos(editor, blockId);
  editor.transact((tr) => {
    tr.setSelection(NodeSelection.create(tr.doc, pos));
  });
}

function findTableCellPositions(editor: BlockNoteEditor): number[] {
  const cells: number[] = [];
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (
      node.type.spec.tableRole === "cell" ||
      node.type.spec.tableRole === "header_cell"
    ) {
      cells.push(pos);
    }
    return true;
  });
  return cells;
}

test("代码块整块保留结构，块内部分文字不带格式", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "标题" },
      {
        id: "code",
        type: "codeBlock",
        props: { language: "math" },
        content: "E=mc^2",
      },
    ],
  });
  const range = findBlockTextRange(editor, "code");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.from));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.from + 1));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);
});

test("分隔线、图片、视频、文件整块保留结构", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "标题" },
      { id: "div", type: "divider" },
      {
        id: "img",
        type: "image",
        props: { url: "data:image/png;base64,AAAA" },
      },
      {
        id: "vid",
        type: "video",
        props: { url: "https://example.com/a.mp4" },
      },
      {
        id: "file",
        type: "file",
        props: { url: "https://example.com/a.pdf", name: "a.pdf" },
      },
    ],
  });
  for (const id of ["div", "img", "vid", "file"]) {
    selectBlockContainer(editor, id);
    expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
      true,
    );
  }
});

test("整表保留结构，部分单元格不带格式", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "标题" },
      {
        id: "tbl",
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            {
              cells: [
                [{ type: "text", text: "维度" }],
                [{ type: "text", text: "pi-mono" }],
              ],
            },
            {
              cells: [
                [{ type: "text", text: "用途" }],
                [{ type: "text", text: "Agent" }],
              ],
            },
          ],
        },
      },
    ],
  });
  const cells = findTableCellPositions(editor);
  expect(cells.length).toBe(4);

  editor.transact((tr) => {
    tr.setSelection(CellSelection.create(tr.doc, cells[0], cells[0]));
  });
  expect(isWholeTableCellSelection(editor.prosemirrorState)).toBe(false);
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(
    false,
  );
  expect(resolveCopyBlockSelection(editor.prosemirrorState)).toBeNull();

  editor.transact((tr) => {
    tr.setSelection(CellSelection.create(tr.doc, cells[0], cells[3]));
  });
  expect(isWholeTableCellSelection(editor.prosemirrorState)).toBe(true);
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);
  const resolved = resolveCopyBlockSelection(editor.prosemirrorState);
  expect(resolved).toBeInstanceOf(NodeSelection);
  expect((resolved as NodeSelection).node.firstChild?.type.name).toBe("table");
});

test("跨多个有序列表即使选区越界也带格式", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "heading", type: "heading", content: "标题" },
      { id: "n1", type: "numberedListItem", content: "123" },
      { id: "n2", type: "numberedListItem", content: "333" },
      { id: "n3", type: "numberedListItem", content: "444" },
    ],
  });
  const first = findBlockTextRange(editor, "n1");
  const last = findBlockTextRange(editor, "n3");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, first.from + 1, last.to));
  });
  expect(shouldCopyClipboardWithFormatting(editor.prosemirrorState)).toBe(true);
  expect(resolveCopyBlockSelection(editor.prosemirrorState)).not.toBeNull();
});
