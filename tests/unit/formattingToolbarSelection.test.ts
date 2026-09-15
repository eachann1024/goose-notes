import { BlockNoteEditor } from "@blocknote/core";
import { AllSelection, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "prosemirror-tables";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  getFormattingSelectionMode,
  getFormattingToolbarCapabilities,
  isFormattingToolbarOpen,
  resolveFormattingToolbarAiBlockId,
  shouldRenderFormattingToolbar,
} from "../../src/components/editor/toolbars/formatting/helpers";

function createEditor(content: Array<Record<string, unknown>>) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: content as any,
  });
}

function findNodePosition(
  editor: ReturnType<typeof createEditor>,
  type: string,
) {
  let result: number | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === type) {
      result = pos;
      return false;
    }
    return result === null;
  });
  if (result === null) throw new Error(`Missing ${type} node`);
  return result;
}

function findMarkedTextRange(
  editor: ReturnType<typeof createEditor>,
  markName: string,
) {
  let result: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((mark) => mark.type.name === markName)) {
      result = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return result === null;
  });
  if (result === null) throw new Error(`Missing ${markName} text`);
  return result;
}

test("整块选中代码块时不触发格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
  ]);
  const codeBlockPos = findNodePosition(editor, "codeBlock");

  editor.transact((tr) => {
    tr.setSelection(NodeSelection.create(tr.doc, codeBlockPos));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("仅有代码块的文档全选时不触发格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("代码块与普通正文混合选中时仍允许格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
    { id: "body", type: "paragraph", content: "普通正文" },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});

test("选中行内代码时仍触发格式工具栏（可取消 code）", () => {
  const editor = createEditor([
    {
      id: "body",
      type: "paragraph",
      content: [
        { type: "text", text: "之前 " },
        {
          type: "text",
          text: "/path/to/application-dev.yml",
          styles: { code: true },
        },
        { type: "text", text: " 之后" },
      ],
    },
  ]);
  const codeRange = findMarkedTextRange(editor, "code");

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, codeRange.from, codeRange.to));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});

test("部分选中行内代码时仍触发格式工具栏（可取消 code）", () => {
  const editor = createEditor([
    {
      id: "body",
      type: "paragraph",
      content: [
        { type: "text", text: "之前 " },
        { type: "text", text: "inline-code", styles: { code: true } },
        { type: "text", text: " 之后" },
      ],
    },
  ]);
  const codeRange = findMarkedTextRange(editor, "code");

  editor.transact((tr) => {
    tr.setSelection(
      TextSelection.create(tr.doc, codeRange.from + 2, codeRange.to - 2),
    );
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});

test("行内代码与普通文字混合选中时仍允许格式工具栏", () => {
  const editor = createEditor([
    {
      id: "body",
      type: "paragraph",
      content: [
        { type: "text", text: "之前 " },
        { type: "text", text: "inline-code", styles: { code: true } },
        { type: "text", text: " 之后" },
      ],
    },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});

function findTextRange(editor: ReturnType<typeof createEditor>, text: string) {
  let result: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.isText && node.text === text) {
      result = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return result === null;
  });
  if (result === null) throw new Error(`Missing text: ${text}`);
  return result;
}

function cellPosForText(editor: ReturnType<typeof createEditor>, text: string) {
  const range = findTextRange(editor, text);
  const $pos = editor.prosemirrorState.doc.resolve(range.from);
  for (let d = $pos.depth; d > 0; d -= 1) {
    const role = $pos.node(d).type.spec?.tableRole;
    if (role === "cell" || role === "header_cell") return $pos.before(d);
  }
  throw new Error(`Missing cell for: ${text}`);
}

function createTableEditor() {
  return createEditor([
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
  ]);
}

test("表格单元格内选中文字时允许格式工具栏", () => {
  const editor = createEditor([
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
  ]);

  const range = findTextRange(editor, "pi-mono");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
  expect(getFormattingSelectionMode(editor)).toBe("cellText");
  const caps = getFormattingToolbarCapabilities(editor);
  expect(caps.showAlign).toBe(true);
  expect(caps.showLink).toBe(true);
  expect(caps.showMarks).toBe(true);
});

test("表格块无文字选区时不触发格式工具栏", () => {
  const editor = createEditor([
    {
      id: "tbl",
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          {
            cells: [
              [{ type: "text", text: "A" }],
              [{ type: "text", text: "B" }],
            ],
          },
        ],
      },
    },
  ]);

  // 空选区
  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("锁定/只读时不触发格式工具栏", () => {
  const editor = createEditor([
    { id: "body", type: "paragraph", content: "普通正文" },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });
  expect(shouldRenderFormattingToolbar(editor)).toBe(true);

  editor.isEditable = false;
  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("表格内选中文字时能解析 AI 锚点 block id", () => {
  const editor = createEditor([
    {
      id: "tbl-ai",
      type: "table",
      content: {
        type: "tableContent",
        rows: [
          {
            cells: [
              [{ type: "text", text: "左列" }],
              [{ type: "text", text: "右列文字" }],
            ],
          },
        ],
      },
    },
  ]);

  const range = findTextRange(editor, "右列文字");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });

  const blockId = resolveFormattingToolbarAiBlockId(editor);
  expect(blockId).toBeTruthy();
});

test("跨单元格 TextSelection（用途→维度）→ mode cellGrid，仍显示格式工具栏", () => {
  const editor = createTableEditor();
  const from = findTextRange(editor, "用途");
  const to = findTextRange(editor, "维度");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from.from, to.to));
  });

  expect(getFormattingSelectionMode(editor)).toBe("cellGrid");
  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});

test("已有选区再拖选时，pointer 按住期间仍保持格式工具栏打开", () => {
  const gates = {
    editable: true,
    suppress: false,
    aiActive: false,
    storeOpen: false,
    selectionAllowed: false,
  };

  expect(isFormattingToolbarOpen({ ...gates, holdDuringPointerSelect: false })).toBe(
    false,
  );
  expect(isFormattingToolbarOpen({ ...gates, holdDuringPointerSelect: true })).toBe(
    true,
  );
});

test("空白点击抑制或 AI 激活时，即使按住也不打开格式工具栏", () => {
  const holding = {
    editable: true,
    storeOpen: false,
    selectionAllowed: false,
    holdDuringPointerSelect: true,
  };

  expect(
    isFormattingToolbarOpen({ ...holding, suppress: true, aiActive: false }),
  ).toBe(false);
  expect(
    isFormattingToolbarOpen({ ...holding, suppress: false, aiActive: true }),
  ).toBe(false);
  expect(
    isFormattingToolbarOpen({
      ...holding,
      editable: false,
      suppress: false,
      aiActive: false,
    }),
  ).toBe(false);
});

test("未按住时格式工具栏仍要求 store 与选区同时成立", () => {
  const rest = {
    editable: true,
    suppress: false,
    aiActive: false,
    holdDuringPointerSelect: false,
  };

  expect(
    isFormattingToolbarOpen({ ...rest, storeOpen: true, selectionAllowed: false }),
  ).toBe(false);
  expect(
    isFormattingToolbarOpen({ ...rest, storeOpen: false, selectionAllowed: true }),
  ).toBe(false);
  expect(
    isFormattingToolbarOpen({ ...rest, storeOpen: true, selectionAllowed: true }),
  ).toBe(true);
});

test("CellSelection 覆盖两格 → mode cellGrid，仍显示格式工具栏", () => {
  const editor = createTableEditor();
  const fromCell = cellPosForText(editor, "用途");
  const toCell = cellPosForText(editor, "维度");
  editor.transact((tr) => {
    tr.setSelection(CellSelection.create(tr.doc, fromCell, toCell));
  });

  expect(getFormattingSelectionMode(editor)).toBe("cellGrid");
  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});
