import { expect, test } from "playwright/test";
import {
  isQuickNoteEditorPage,
  shouldUseRawEditorContent,
} from "../../src/pages/workspace/components/editor-host/editorContentMode";

test("quicknote draft page is recognized as the compact host", () => {
  expect(isQuickNoteEditorPage({ id: "__quicknote_draft__" })).toBe(true);
  expect(isQuickNoteEditorPage({ id: "internal-page" })).toBe(false);
  expect(isQuickNoteEditorPage(null)).toBe(false);
});

test("quicknote drafts and local files keep raw editor content when syncing", () => {
  expect(
    shouldUseRawEditorContent({
      id: "__quicknote_draft__",
    }),
  ).toBe(true);

  expect(
    shouldUseRawEditorContent({
      id: "local-page",
      localFilePath: "C:/notes/local.md",
    }),
  ).toBe(true);

  expect(
    shouldUseRawEditorContent({
      id: "unsaved-local",
      localUnsaved: true,
    }),
  ).toBe(true);

  expect(
    shouldUseRawEditorContent({
      id: "internal-page",
    }),
  ).toBe(false);

  expect(shouldUseRawEditorContent(null)).toBe(false);
  expect(shouldUseRawEditorContent(undefined)).toBe(false);
});
