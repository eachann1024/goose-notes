import { expect, test } from "playwright/test";
import {
  findActivePageMentionQuery,
  isPageMentionBoundaryChar,
  isSuggestionMenuAcceptKey,
  mentionTriggerDeleteRange,
} from "../../src/components/editor/utils/slashMenuPolicy";
import {
  isWikiMediaTarget,
  parseWikiLinkInner,
  serializeWikiLinkMarkdown,
} from "../../src/lib/wikiLink";
import { looksLikeMarkdownFragment } from "../../src/components/editor/utils/clipboard";

test("isPageMentionBoundaryChar：邮箱不弹，中文和空白弹", () => {
  expect(isPageMentionBoundaryChar("")).toBe(true);
  expect(isPageMentionBoundaryChar(" ")).toBe(true);
  expect(isPageMentionBoundaryChar("见")).toBe(true);
  expect(isPageMentionBoundaryChar("，")).toBe(true);
  expect(isPageMentionBoundaryChar("a")).toBe(false);
  expect(isPageMentionBoundaryChar("9")).toBe(false);
  expect(isPageMentionBoundaryChar("@")).toBe(false);
});

test("findActivePageMentionQuery 只认光标前的边界 @", () => {
  expect(findActivePageMentionQuery("见@周")).toEqual({ atIndex: 1, query: "周" });
  expect(findActivePageMentionQuery("@")).toEqual({ atIndex: 0, query: "" });
  expect(findActivePageMentionQuery("user@name")).toBeNull();
  expect(findActivePageMentionQuery("见@周 报")).toBeNull();
});

test("mentionTriggerDeleteRange 含触发符，避免选中后外面还留 @", () => {
  expect(mentionTriggerDeleteRange(10, "hello @server", 23)).toEqual({
    from: 16,
    to: 23,
  });
  expect(mentionTriggerDeleteRange(10, "hello @", 17)).toEqual({
    from: 16,
    to: 17,
  });
  expect(mentionTriggerDeleteRange(10, "hello ", 16)).toBeNull();
});

test("isSuggestionMenuAcceptKey：Enter 与无修饰 Tab 确认，Shift/Ctrl/Cmd Tab 不确认", () => {
  expect(isSuggestionMenuAcceptKey({ key: "Enter" })).toBe(true);
  expect(isSuggestionMenuAcceptKey({ key: "Enter", shiftKey: true })).toBe(
    false,
  );
  expect(isSuggestionMenuAcceptKey({ key: "Tab" })).toBe(true);
  expect(isSuggestionMenuAcceptKey({ key: "Tab", shiftKey: true })).toBe(
    false,
  );
  expect(isSuggestionMenuAcceptKey({ key: "Tab", ctrlKey: true })).toBe(
    false,
  );
  expect(isSuggestionMenuAcceptKey({ key: "Tab", metaKey: true })).toBe(false);
  expect(isSuggestionMenuAcceptKey({ key: "Tab", altKey: true })).toBe(false);
  expect(isSuggestionMenuAcceptKey({ key: "Escape" })).toBe(false);
});

test("parseWikiLinkInner 覆盖 alias、heading、路径", () => {
  expect(parseWikiLinkInner("Note")).toEqual({ target: "Note", alias: "" });
  expect(parseWikiLinkInner("folder/Note.md|别名")).toEqual({
    target: "folder/Note",
    alias: "别名",
  });
  expect(parseWikiLinkInner("Note#Heading")).toEqual({
    target: "Note",
    alias: "",
  });
  expect(parseWikiLinkInner("#Heading")).toBeNull();
  expect(parseWikiLinkInner("cover.png")).toBeNull();
  expect(isWikiMediaTarget("assets/photo.jpg")).toBe(true);
  expect(serializeWikiLinkMarkdown("folder/Note", "别名")).toBe(
    "[[folder/Note|别名]]",
  );
});

test("looksLikeMarkdownFragment 把双链当 markdown", () => {
  expect(looksLikeMarkdownFragment("见 [[周报]]")).toBe(true);
});
