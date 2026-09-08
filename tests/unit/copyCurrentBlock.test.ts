import { BlockNoteEditor } from "@blocknote/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  getCurrentBlockNodeSelection,
  resolveCopyBlockSelection,
} from "../../src/components/editor/extensions/copyCurrentBlockExtension";

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

test("折叠光标时 resolveCopyBlockSelection 返回 null", () => {
  const editor = createEditor();
  expect(resolveCopyBlockSelection(editor.prosemirrorState)).toBeNull();
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
