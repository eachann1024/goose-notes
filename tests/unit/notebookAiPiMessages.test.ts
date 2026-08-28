import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import type { NotebookAiMessage } from "../../src/lib/notebook-ai/types";
import { collectLoadedSkillIds } from "../../src/lib/notebook-ai/pi/messages";

test("后续对话只恢复历史中成功完成的 Skill", () => {
  const messages = [
    {
      id: "assistant-history",
      role: "assistant",
      parts: [
        {
          type: "tool-loadSkill",
          toolCallId: "skill-success",
          state: "output-available",
          input: { skill: "updateNote" },
          output: { skill: "updateNote", supported: true },
        },
        {
          type: "tool-loadSkill",
          toolCallId: "skill-error",
          state: "output-error",
          input: { skill: "deleteNote" },
          errorText: "加载失败",
        },
        {
          type: "tool-loadSkill",
          toolCallId: "skill-incomplete",
          state: "input-available",
          input: { skill: "searchNotes" },
        },
        {
          type: "tool-loadSkill",
          toolCallId: "skill-unknown",
          state: "output-available",
          input: { skill: "unknown" },
          output: { supported: true },
        },
      ],
    },
  ] as unknown as NotebookAiMessage[];

  expect(collectLoadedSkillIds(messages)).toEqual(["updateNote"]);
});

test("同一 Skill 多次成功加载时只恢复一次", () => {
  const messages = [
    {
      id: "assistant-history",
      role: "assistant",
      parts: [
        {
          type: "tool-loadSkill",
          state: "output-available",
          input: { skill: "chat" },
          output: { supported: true },
        },
        {
          type: "tool-loadSkill",
          state: "output-available",
          input: { skill: "chat" },
          output: { supported: true },
        },
      ],
    },
  ] as unknown as NotebookAiMessage[];

  expect(collectLoadedSkillIds(messages)).toEqual(["chat"]);
});

test("Pi 桥把 thinking_delta 写成 reasoning 流", () => {
  const transport = readFileSync(
    new URL("../../src/lib/notebook-ai/pi/transport.ts", import.meta.url),
    "utf8",
  );
  expect(transport).toContain('ame.type === "thinking_delta"');
  expect(transport).toContain('type: "reasoning-start"');
  expect(transport).toContain('type: "reasoning-delta"');
  expect(transport).toContain("endReasoning()");
});
