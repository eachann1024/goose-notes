import { expect, test } from "playwright/test";
import { collectNotebookAiMessageSkills } from "../../src/lib/notebook-ai/context";
import {
  buildUserMessageSegments,
  inferSkillsFromDisplayText,
} from "../../src/lib/notebook-ai/userMessageSegments";

test("collectNotebookAiMessageSkills：合并 payload.skills 与 skill tokens 并按 name 去重", () => {
  const skills = collectNotebookAiMessageSkills({
    skills: [
      {
        name: "grill-me",
        path: "/home/.agents/skills/grill-me/SKILL.md",
        description: "追问",
      },
    ],
    tokens: [
      { type: "text", text: "用 " },
      {
        type: "skill",
        skill: {
          name: "grill-me",
          description: "重复应忽略",
        },
      },
      {
        type: "skill",
        skill: { name: "summarize", description: "摘要" },
      },
    ],
  });

  expect(skills).toEqual([
    {
      name: "grill-me",
      path: "/home/.agents/skills/grill-me/SKILL.md",
      description: "追问",
    },
    { name: "summarize", description: "摘要" },
  ]);
});

test("collectNotebookAiMessageSkills：skills/tokens 皆空时用 invokedSkill 兜底", () => {
  const skills = collectNotebookAiMessageSkills(
    { skills: [], tokens: [{ type: "text", text: "/foo 你好" }] },
    {
      name: "foo",
      path: "/home/.agents/skills/foo/SKILL.md",
      description: "本地 skill",
    },
  );

  expect(skills).toEqual([
    {
      name: "foo",
      path: "/home/.agents/skills/foo/SKILL.md",
      description: "本地 skill",
    },
  ]);
});

test("collectNotebookAiMessageSkills：无任何 skill 时返回 undefined", () => {
  expect(
    collectNotebookAiMessageSkills({
      skills: [],
      tokens: [{ type: "text", text: "普通提问" }],
    }),
  ).toBeUndefined();
  expect(collectNotebookAiMessageSkills({}, null)).toBeUndefined();
});

test("buildUserMessageSegments：含 /grill-me 与 skills 时拆出 skill 段", () => {
  const segments = buildUserMessageSegments(
    "/grill-me 你好",
    [],
    [{ name: "grill-me", description: "追问" }],
  );

  expect(segments).toEqual([
    {
      type: "skill",
      skill: { name: "grill-me", description: "追问" },
      key: "skill-grill-me-0",
    },
    { type: "text", text: " 你好" },
  ]);
});

test("buildUserMessageSegments：metadata.skills 为空时从文本 fallback 扫 /name", () => {
  const segments = buildUserMessageSegments("/grill-me 你好", [], []);

  expect(segments).toEqual([
    {
      type: "skill",
      skill: { name: "grill-me" },
      key: "skill-grill-me-0",
    },
    { type: "text", text: " 你好" },
  ]);
});

test("buildUserMessageSegments：skill 与 @ 引用可共存", () => {
  const segments = buildUserMessageSegments(
    "请用 /summarize 总结 @会议纪要",
    [
      {
        pageId: "p1",
        titleSnapshot: "会议纪要",
        notebookId: "nb1",
        notebookNameSnapshot: "工作",
      } as never,
    ],
    [{ name: "summarize" }],
  );

  expect(segments.map((s) => s.type)).toEqual([
    "text",
    "skill",
    "text",
    "reference",
  ]);
  expect(segments[1]).toMatchObject({
    type: "skill",
    skill: { name: "summarize" },
  });
  expect(segments[3]).toMatchObject({
    type: "reference",
    reference: { pageId: "p1", titleSnapshot: "会议纪要" },
  });
});

test("buildUserMessageSegments：正文路径 /Profile 不当 skill chip", () => {
  const text =
    "真机调试签名：要华为开发者账号 + AGC 调试证书 /Profile , 不能再用 OpenHarmony 自带 debug 证书";
  const segments = buildUserMessageSegments(text, [], []);
  expect(segments).toEqual([{ type: "text", text }]);
});

test("buildUserMessageSegments：Unix 路径不当 skill chip", () => {
  const text = "证书在 /usr/bin 和 /etc/passwd";
  expect(buildUserMessageSegments(text, [], [])).toEqual([
    { type: "text", text },
  ]);
});

test("buildUserMessageSegments：metadata skill 不吞路径片段", () => {
  const text = "请打开 /profile/settings";
  const segments = buildUserMessageSegments(text, [], [{ name: "profile" }]);
  expect(segments).toEqual([{ type: "text", text }]);
});

test("inferSkillsFromDisplayText：大小写路径与词中斜杠不推断", () => {
  expect(inferSkillsFromDisplayText("证书 /Profile")).toEqual([]);
  expect(inferSkillsFromDisplayText("x/foo")).toEqual([]);
  expect(inferSkillsFromDisplayText("/grill-me 你好")).toEqual([
    { name: "grill-me" },
  ]);
});
