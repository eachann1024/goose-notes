import { expect, test } from "playwright/test";
import {
  matchComposerPayloadSlashCommand,
  matchExactComposerSlashCommand,
  searchComposerSlashItems,
  slashItemTitle,
} from "../../src/lib/notebook-ai/composerSlashCommands";
import {
  buildCompactedConversation,
  COMPACT_DISPLAY_TEXT,
  conversationHasCompactableContent,
  formatConversationTranscript,
  wrapCompactSummaryForDisplay,
} from "../../src/lib/notebook-ai/compactConversation";
import type { NotebookAiMessage } from "../../src/lib/notebook-ai/types";

test("searchComposerSlashItems：空查询先列出中文内置指令", () => {
  const items = searchComposerSlashItems("", { includeSkills: false });
  expect(items.map(slashItemTitle)).toEqual(["/新会话", "/压缩"]);
});

test("searchComposerSlashItems：英文 /new /compact 也能命中中文指令", () => {
  const newItems = searchComposerSlashItems("new", { includeSkills: false });
  expect(newItems.map(slashItemTitle)).toEqual(["/新会话"]);

  const compactItems = searchComposerSlashItems("compact", {
    includeSkills: false,
  });
  expect(compactItems.map(slashItemTitle)).toEqual(["/压缩"]);
});

test("searchComposerSlashItems：中文前缀也能筛出对应指令", () => {
  expect(
    searchComposerSlashItems("新", { includeSkills: false }).map(
      slashItemTitle,
    ),
  ).toEqual(["/新会话"]);
  expect(
    searchComposerSlashItems("压缩", { includeSkills: false }).map(
      slashItemTitle,
    ),
  ).toEqual(["/压缩"]);
});

test("matchExactComposerSlashCommand：必须带斜杠，中英文都能触发", () => {
  expect(matchExactComposerSlashCommand("/new")).toBe("new");
  expect(matchExactComposerSlashCommand("/NEW")).toBe("new");
  expect(matchExactComposerSlashCommand(" /新会话 ")).toBe("new");
  expect(matchExactComposerSlashCommand("/compact")).toBe("compact");
  expect(matchExactComposerSlashCommand("/压缩")).toBe("compact");
  expect(matchExactComposerSlashCommand("new")).toBeNull();
  expect(matchExactComposerSlashCommand("/new 继续")).toBeNull();
});

test("matchComposerPayloadSlashCommand：有引用或图片时不拦截", () => {
  expect(
    matchComposerPayloadSlashCommand({
      promptText: "/new",
      references: [],
      images: [],
      skills: [],
    }),
  ).toBe("new");
  expect(
    matchComposerPayloadSlashCommand({
      promptText: "/compact",
      references: [],
      images: [],
      skills: [{ name: "compact" }],
    }),
  ).toBeNull();
});

function textMessage(
  role: "user" | "assistant",
  text: string,
  displayText?: string,
): NotebookAiMessage {
  return {
    id: `${role}-${text}`,
    role,
    parts: [{ type: "text", text }],
    metadata: displayText
      ? { displayText, createdAt: 1 }
      : { createdAt: 1 },
  };
}

test("formatConversationTranscript：用户消息优先 displayText", () => {
  const transcript = formatConversationTranscript([
    textMessage("user", "用户输入：隐藏上下文", "请总结这篇笔记"),
    textMessage("assistant", "这是结论"),
  ]);
  expect(transcript).toContain("用户：\n请总结这篇笔记");
  expect(transcript).toContain("助手：\n这是结论");
  expect(transcript).not.toContain("隐藏上下文");
});

test("conversationHasCompactableContent：空会话不可压缩", () => {
  expect(conversationHasCompactableContent([])).toBe(false);
  expect(
    conversationHasCompactableContent([textMessage("user", "你好")]),
  ).toBe(true);
});

test("buildCompactedConversation：界面显示 /压缩，正文是摘要", () => {
  const messages = buildCompactedConversation({
    summary: "用户要写一篇周报，已确认用三条要点。",
    createId: (prefix) => `${prefix}-id`,
    now: 42,
  });
  expect(messages).toHaveLength(2);
  expect(messages[0]?.metadata?.displayText).toBe(COMPACT_DISPLAY_TEXT);
  expect(messages[0]?.metadata?.compacted).toBe(true);
  expect(messages[1]?.parts?.[0]).toMatchObject({
    type: "text",
    text: wrapCompactSummaryForDisplay(
      "用户要写一篇周报，已确认用三条要点。",
    ),
  });
});
