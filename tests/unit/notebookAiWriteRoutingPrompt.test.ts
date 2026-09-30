import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const agents = readFileSync(
  new URL("../../src/agent/AGENTS.md", import.meta.url),
  "utf8",
);
const chatSkill = readFileSync(
  new URL("../../src/agent/chat/SKILL.md", import.meta.url),
  "utf8",
);
const skillsTs = readFileSync(
  new URL("../../src/lib/notebook-ai/skills.ts", import.meta.url),
  "utf8",
);
const loadSkillTs = readFileSync(
  new URL("../../src/lib/notebook-ai/tools/skills.ts", import.meta.url),
  "utf8",
);

test("补充当前页内容的路由只写在 AGENTS.md，chat 不抢写入", () => {
  expect(agents).toContain(
    "改当前页已有内容（含补充、完善、展开、改写、追加某项）：`updateNote`",
  );
  expect(agents).toContain("直接提交计划，不要先拟稿再问");
  expect(chatSkill).toContain("且本轮不改笔记");
  expect(chatSkill).not.toContain("用户没有要求写入笔记");
  expect(skillsTs).toContain("改写、追加、补充或重命名当前页");
  expect(skillsTs).toContain("仅解释或建议，不改笔记");
  expect(loadSkillTs).toContain("NOTEBOOK_SKILLS[id].description");
});
