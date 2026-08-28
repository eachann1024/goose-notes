import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { pasteClipboardFilesFromClipboard } from "../../src/components/editor/utils/pasteClipboardFilesFromClipboard";

function pngFile(name = "shot.png"): File {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return new File([bytes], name, { type: "image/png" });
}

function pasteEvent(file: File): ClipboardEvent {
  return {
    preventDefault() {},
    clipboardData: {
      items: [
        {
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        },
      ],
    },
  } as unknown as ClipboardEvent;
}

function imageBlocks(editor: BlockNoteEditor) {
  return editor.document.filter((block) => block.type === "image");
}

function createEditor(
  content: Array<Record<string, unknown>>,
  uploadFile: (file: File, blockId?: string) => Promise<string>,
) {
  const editor = BlockNoteEditor.create({
    initialContent: content as any,
    uploadFile,
  });
  editor.setTextCursorPosition(content[0]!.id as string);

  const docTransactions: Array<{ addToHistory: unknown }> = [];
  const origTransact = editor.transact.bind(editor);
  let depth = 0;
  editor.transact = ((callback: (tr: { docChanged: boolean; getMeta: (key: string) => unknown }) => unknown) => {
    depth += 1;
    try {
      return origTransact((tr) => {
        const result = callback(tr);
        if (depth === 1 && tr.docChanged) {
          docTransactions.push({ addToHistory: tr.getMeta("addToHistory") });
        }
        return result;
      });
    } finally {
      depth -= 1;
    }
  }) as typeof editor.transact;

  return { editor, docTransactions };
}

test("粘贴图片：先插入占位，再无历史地写 url，避免撤回留下空图", async () => {
  let dispatchesBeforeUpload = 0;
  const { editor, docTransactions } = createEditor(
    [{ id: "p1", type: "paragraph", content: "hello" }],
    async () => {
      dispatchesBeforeUpload = docTransactions.length;
      return "https://example.com/shot.png";
    },
  );

  await pasteClipboardFilesFromClipboard(pasteEvent(pngFile()), editor);

  const pasted = imageBlocks(editor);
  expect(pasted).toHaveLength(1);
  expect((pasted[0]?.props as { url?: string }).url).toBe(
    "https://example.com/shot.png",
  );

  // 占位块 + 末尾空段落合成一次文档事务
  expect(dispatchesBeforeUpload).toBe(1);
  expect(docTransactions[0]?.addToHistory).not.toBe(false);

  // 上传后的 url 不进 undo；撤回会整段回到粘贴前，而不是只摘掉 url
  expect(docTransactions.length).toBe(2);
  expect(docTransactions[1]?.addToHistory).toBe(false);
});

test("空段落里粘贴后，url 更新同样不进 undo", async () => {
  const { editor, docTransactions } = createEditor(
    [{ id: "p1", type: "paragraph", content: "" }],
    async () => "https://example.com/empty.png",
  );

  await pasteClipboardFilesFromClipboard(pasteEvent(pngFile()), editor);

  const pasted = editor.getBlock("p1");
  expect(pasted?.type).toBe("image");
  expect((pasted?.props as { url?: string }).url).toBe(
    "https://example.com/empty.png",
  );
  expect(docTransactions.at(-1)?.addToHistory).toBe(false);
});

test("上传过程中块已被撤掉时，完成后不再写回图片", async () => {
  const { editor } = createEditor(
    [{ id: "p1", type: "paragraph", content: "hello" }],
    async (_file, blockId) => {
      if (blockId) editor.removeBlocks([blockId]);
      return "https://example.com/late.png";
    },
  );

  await pasteClipboardFilesFromClipboard(pasteEvent(pngFile()), editor);

  expect(imageBlocks(editor)).toHaveLength(0);
  expect(editor.getBlock("p1")?.type).toBe("paragraph");
});
