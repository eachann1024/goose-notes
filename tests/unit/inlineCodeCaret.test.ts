import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "@playwright/test";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  edgeGraphemeLength,
  handleArrow,
  inlineCodeEdgeArrowAction,
  inlineCodeEdgeAt,
  shouldKeepInlineCodeDomCaret,
} from "../../src/components/editor/extensions/inlineCodeCaretExtension";
import {
  resolveWordDelete,
  storedMarksForCodeEdge,
} from "../../src/components/editor/extensions/inlineCodeWordBoundary";

function createEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "body",
        type: "paragraph",
        content: [
          { type: "text", text: "AB" },
          { type: "text", text: "XY", styles: { code: true } },
          { type: "text", text: "CD" },
        ],
      },
    ] as never,
  });
}

test("字素长度按可见字符切分，emoji 不会被拆成半个", () => {
  expect(edgeGraphemeLength("abc", "start")).toBe(1);
  expect(edgeGraphemeLength("abc", "end")).toBe(1);
  expect(edgeGraphemeLength("", "start")).toBe(0);
  expect(edgeGraphemeLength("🎉a", "start")).toBe(2);
  expect(edgeGraphemeLength("a🎉", "end")).toBe(2);
});

test("方向键在边界上的四种组合：朝内先进盒、朝外先出盒", () => {
  expect(inlineCodeEdgeArrowAction("start", false, "right")).toBe("enter");
  expect(inlineCodeEdgeArrowAction("start", true, "right")).toBe("step-inward");
  expect(inlineCodeEdgeArrowAction("start", true, "left")).toBe("leave");
  expect(inlineCodeEdgeArrowAction("start", false, "left")).toBe(null);

  expect(inlineCodeEdgeArrowAction("end", false, "left")).toBe("enter");
  expect(inlineCodeEdgeArrowAction("end", true, "left")).toBe("step-inward");
  expect(inlineCodeEdgeArrowAction("end", true, "right")).toBe("leave");
  expect(inlineCodeEdgeArrowAction("end", false, "right")).toBe(null);
});

test("从行内代码右侧连续按左键可以逐字进入，不会弹回盒外", () => {
  const editor = createEditor();
  let state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;
  let codeTo = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks)) codeTo = pos + node.nodeSize;
  });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, codeTo)));
  const view = {
    get state() { return state; },
    dispatch(tr: typeof state.tr) { state = state.apply(tr); },
  } as EditorView;

  expect(handleArrow(view, "left")).toBe(true); // 先到 Y 后、盒内右边界
  expect(state.selection.from).toBe(codeTo);
  expect(codeType.isInSet(state.storedMarks ?? [])).toBeTruthy();
  expect(handleArrow(view, "left")).toBe(true); // 再经过 Y
  expect(state.selection.from).toBe(codeTo - 1);
  expect(handleArrow(view, "left")).toBe(true); // 继续经过 X，不能交给浏览器弹回
  expect(state.selection.from).toBe(codeTo - 2);
});

test("只有代码段两端算边界，段内与纯文本都不算", () => {
  const editor = createEditor();
  const state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;

  let codeFrom = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks)) codeFrom = pos;
    return codeFrom < 0;
  });
  expect(codeFrom).toBeGreaterThan(0);

  const edgeAt = (pos: number) =>
    inlineCodeEdgeAt(state.doc.resolve(pos), codeType);

  expect(edgeAt(codeFrom)).toBe("start");
  expect(edgeAt(codeFrom + 1)).toBe(null);
  expect(edgeAt(codeFrom + 2)).toBe("end");
  expect(edgeAt(codeFrom - 1)).toBe(null);
  expect(edgeAt(codeFrom + 3)).toBe(null);
});

test("代码 mark 右边界缺省在盒外，左边界缺省也在盒外", () => {
  const editor = createEditor();
  const state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;

  let codeFrom = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks)) codeFrom = pos;
    return codeFrom < 0;
  });

  expect(codeType.isInSet(state.doc.resolve(codeFrom + 2).marks())).toBeFalsy();
  expect(codeType.isInSet(state.doc.resolve(codeFrom).marks())).toBeFalsy();
  expect(
    codeType.isInSet(state.doc.resolve(codeFrom + 1).marks()),
  ).toBeTruthy();
});

test("按词删除在行内代码两端截断，盒外不会把代码内容一起删掉", () => {
  const editor = createEditor();
  const state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;

  let codeFrom = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks)) codeFrom = pos;
    return codeFrom < 0;
  });
  const codeTo = codeFrom + 2;
  const afterTextEnd = codeTo + 2;

  const planAfter = resolveWordDelete(
    state.doc.resolve(afterTextEnd),
    "backward",
    codeType,
    false,
    null,
  );
  expect(planAfter).toEqual({ from: codeTo, to: afterTextEnd });

  const planAtEdge = resolveWordDelete(
    state.doc.resolve(codeTo),
    "backward",
    codeType,
    false,
    "end",
  );
  expect(planAtEdge).toBe("swallow");

  const planInside = resolveWordDelete(
    state.doc.resolve(codeTo),
    "backward",
    codeType,
    true,
    "end",
  );
  expect(planInside).toEqual({ from: codeFrom, to: codeTo });

  const planBefore = resolveWordDelete(
    state.doc.resolve(codeFrom),
    "forward",
    codeType,
    false,
    "start",
  );
  expect(planBefore).toBe("swallow");
});

test("紧贴行内代码的中文按词删，不会把代码内容算进同一段", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "body",
        type: "paragraph",
        content: [
          { type: "text", text: "*-lock.yaml", styles: { code: true } },
          { type: "text", text: "这类文件" },
        ],
      },
    ] as never,
  });
  const state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;
  let codeFrom = -1;
  let codeText = "";
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks) && codeFrom < 0) {
      codeFrom = pos;
      codeText = node.text ?? "";
    }
  });
  const codeTo = codeFrom + codeText.length;
  const end = codeTo + "这类文件".length;

  expect(
    resolveWordDelete(state.doc.resolve(end), "backward", codeType, false, null),
  ).toEqual({ from: codeTo, to: end });
  expect(
    resolveWordDelete(
      state.doc.resolve(codeTo),
      "backward",
      codeType,
      false,
      "end",
    ),
  ).toBe("swallow");
});

test("盒外 storedMarks 是 null，避免组字被 markCursor 打断", () => {
  const editor = createEditor();
  const state = editor.prosemirrorState;
  const codeType = state.schema.marks.code;

  let codeFrom = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && codeType.isInSet(node.marks)) codeFrom = pos;
    return codeFrom < 0;
  });
  const $end = state.doc.resolve(codeFrom + 2);
  expect(storedMarksForCodeEdge($end, codeType, false)).toBeNull();
  expect(codeType.isInSet(storedMarksForCodeEdge($end, codeType, true) ?? [])).toBeTruthy();
});

test("删到边界时，落在 boundary 节点或盒内外不一致都要重钉光标", () => {
  expect(
    shouldKeepInlineCodeDomCaret({
      wantInside: true,
      contentContainsAnchor: false,
      anchorInBoundary: true,
      atContentInnerEdge: false,
      atCodeOuterEdge: false,
      codeContainsAnchor: true,
    }),
  ).toBe(false);

  expect(
    shouldKeepInlineCodeDomCaret({
      wantInside: true,
      contentContainsAnchor: true,
      anchorInBoundary: false,
      atContentInnerEdge: false,
      atCodeOuterEdge: false,
      codeContainsAnchor: true,
    }),
  ).toBe(true);

  expect(
    shouldKeepInlineCodeDomCaret({
      wantInside: false,
      contentContainsAnchor: false,
      anchorInBoundary: false,
      atContentInnerEdge: false,
      atCodeOuterEdge: true,
      codeContainsAnchor: false,
    }),
  ).toBe(true);

  expect(
    shouldKeepInlineCodeDomCaret({
      wantInside: false,
      contentContainsAnchor: true,
      anchorInBoundary: false,
      atContentInnerEdge: false,
      atCodeOuterEdge: false,
      codeContainsAnchor: true,
    }),
  ).toBe(false);
});
