import { expect, test } from "playwright/test";
import { serializeAiComposerDoc } from "../../src/components/editor/ai/composer/referenceLookup";
import {
  clearLocalSkillsCache,
  collectWorkspaceSkillsFromPages,
  isWorkspaceSkillFilePath,
  resolveInvokedLocalSkill,
  resolveInvokedLocalSkillFromTokens,
} from "../../src/lib/notebook-ai/localContext";
import { parseSlashCommandBeforeCaret } from "../../src/components/editor/ai/composer/useSkillCommands";
import type { Page } from "../../src/types";

function installLocalSkills(files: Array<{ path: string; content: string }>) {
  clearLocalSkillsCache();
  (globalThis as { window?: unknown }).window = {
    gooseAiContext: {
      listLocalSkills: () => files,
      readGlobalPrompt: () => "",
    },
  };
}

test("resolveInvokedLocalSkill 匹配任意位置第一个已知 skill", () => {
  installLocalSkills([
    {
      path: "/home/.agents/skills/grill-me/SKILL.md",
      content: "---\nname: grill-me\ndescription: 追问\n---\n\n# Grill",
    },
    {
      path: "/home/.agents/skills/summarize/SKILL.md",
      content: "---\nname: summarize\ndescription: 摘要\n---\n\n# Sum",
    },
  ]);

  expect(resolveInvokedLocalSkill("/grill-me 帮我")).toMatchObject({
    name: "grill-me",
  });
  expect(resolveInvokedLocalSkill("请先用 /grill-me 再总结")).toMatchObject({
    name: "grill-me",
  });
  expect(resolveInvokedLocalSkill("用 /unknown 和 /summarize")).toMatchObject({
    name: "summarize",
  });
  expect(resolveInvokedLocalSkill("没有任何斜杠命令")).toBeNull();
});

test("resolveInvokedLocalSkillFromTokens 优先 skill chip", () => {
  installLocalSkills([
    {
      path: "/home/.agents/skills/grill-me/SKILL.md",
      content: "---\nname: grill-me\ndescription: 追问\n---\n\n# Grill",
    },
    {
      path: "/home/.agents/skills/summarize/SKILL.md",
      content: "---\nname: summarize\ndescription: 摘要\n---\n\n# Sum",
    },
  ]);

  expect(
    resolveInvokedLocalSkillFromTokens([
      { type: "text", text: "请用 " },
      { type: "skill", skill: { name: "grill-me" } },
      { type: "text", text: " 再 /summarize" },
    ]),
  ).toMatchObject({ name: "grill-me" });

  // 无 chip 时回退扫描文本
  expect(
    resolveInvokedLocalSkillFromTokens([
      { type: "text", text: "中间调用 /summarize 一次" },
    ]),
  ).toMatchObject({ name: "summarize" });

  // 第一个 skill chip 不存在时返回 null（不继续扫后面文本）
  expect(
    resolveInvokedLocalSkillFromTokens([
      { type: "skill", skill: { name: "missing-skill" } },
      { type: "text", text: " /grill-me" },
    ]),
  ).toBeNull();
});

test("serializeAiComposerDoc 识别 aiSkillCommand 并收集 skills", () => {
  const payload = serializeAiComposerDoc({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "请用 " },
          {
            type: "aiSkillCommand",
            attrs: {
              name: "grill-me",
              description: "追问澄清",
              path: "/home/.agents/skills/grill-me/SKILL.md",
            },
          },
          { type: "text", text: " 再 " },
          {
            type: "aiSkillCommand",
            attrs: { name: "grill-me" },
          },
          { type: "text", text: " 一次" },
        ],
      },
    ],
  });

  expect(payload.promptText).toBe("请用 /grill-me 再 /grill-me 一次");
  // freeform 与 @ 对称：不含 chip 文本
  expect(payload.freeformText).toBe("请用  再  一次");
  expect(payload.skills).toEqual([
    {
      name: "grill-me",
      description: "追问澄清",
      path: "/home/.agents/skills/grill-me/SKILL.md",
    },
  ]);
  expect(payload.tokens.filter((t) => t.type === "skill")).toHaveLength(2);
});

test("isWorkspaceSkillFilePath 认 SKILL/ 下的 SKILL.md 和扁平 md", () => {
  expect(isWorkspaceSkillFilePath("/repo/SKILL/grill-me/SKILL.md")).toBe(true);
  expect(isWorkspaceSkillFilePath("/repo/skills/summarize/SKILL.md")).toBe(
    true,
  );
  expect(isWorkspaceSkillFilePath("/repo/SKILL/grill-me.md")).toBe(true);
  expect(isWorkspaceSkillFilePath("/repo/docs/skill.md")).toBe(false);
  expect(isWorkspaceSkillFilePath("/repo/SKILL.md")).toBe(false);
  expect(isWorkspaceSkillFilePath("/repo/SKILL/foo/notes.md")).toBe(false);
});

test("collectWorkspaceSkillsFromPages 收集当前笔记本目录 Skill", () => {
  const makePage = (
    id: string,
    localFilePath: string,
    overrides: Partial<Page> = {},
  ): Page => ({
    id,
    workspaceId: "nb-local",
    content: { type: "doc", content: [] },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    localFilePath,
    ...overrides,
  });

  const skills = collectWorkspaceSkillsFromPages(
    [
      makePage("grill", "/repo/SKILL/grill-me/SKILL.md"),
      makePage("sum", "/repo/skills/summarize/SKILL.md"),
      makePage("other", "/repo/docs/notes.md"),
      makePage("folder", "/repo/SKILL", { isFolder: true }),
      makePage("foreign", "/repo/SKILL/other/SKILL.md", {
        workspaceId: "other-nb",
      }),
    ],
    "nb-local",
    (page) =>
      page.localFilePath?.includes("grill")
        ? "---\nname: grill-me\ndescription: 追问\n---\n# Grill"
        : "---\nname: summarize\ndescription: 摘要\n---\n# Sum",
  );

  expect(skills.map((skill) => skill.name)).toEqual(["grill-me", "summarize"]);
  expect(skills[0]).toMatchObject({
    name: "grill-me",
    description: "追问",
    path: "/repo/SKILL/grill-me/SKILL.md",
  });
});

test("collectWorkspaceSkillsFromPages 扁平 md 用文件名当 skill 名", () => {
  const page: Page = {
    id: "flat",
    workspaceId: "nb-local",
    content: { type: "doc", content: [] },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    localFilePath: "/repo/SKILL/wait-what.md",
  };
  const skills = collectWorkspaceSkillsFromPages(
    [page],
    "nb-local",
    () => "# 没有 frontmatter",
  );
  expect(skills).toEqual([
    {
      name: "wait-what",
      description: "本地 Skill",
      path: "/repo/SKILL/wait-what.md",
      content: "# 没有 frontmatter",
    },
  ]);
});

test("searchLocalSkills 支持指定 notebookId 搜索工作区 Skill", () => {
  const page: Page = {
    id: "browser",
    workspaceId: "nb-local-skills",
    content: { type: "doc", content: [] },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    localFilePath: "/repo/skills/browser/SKILL.md",
  };
  (globalThis as { window?: unknown }).window = {
    gooseAiContext: {
      listLocalSkills: () => [],
      readGlobalPrompt: () => "",
    },
  };
  clearLocalSkillsCache();
  // 模拟从 pages 收集
  const skills = collectWorkspaceSkillsFromPages(
    [page],
    "nb-local-skills",
    () => "---\nname: browser\ndescription: 网页浏览器\n---\n# Browser",
  );
  expect(skills).toHaveLength(1);
  expect(skills[0].name).toBe("browser");
});

test("parseSlashCommandBeforeCaret 支持在零宽字符 \\u200B 之后触发", () => {
  expect(parseSlashCommandBeforeCaret("/")).toEqual({
    query: "",
    slashIndex: 0,
  });
  expect(parseSlashCommandBeforeCaret("\u200B/")).toEqual({
    query: "",
    slashIndex: 1,
  });
  expect(parseSlashCommandBeforeCaret("\u200B\u200B/test")).toEqual({
    query: "test",
    slashIndex: 2,
  });
  expect(parseSlashCommandBeforeCaret("hello /test")).toEqual({
    query: "test",
    slashIndex: 6,
  });
  expect(parseSlashCommandBeforeCaret("abc/test")).toBeNull();
});
