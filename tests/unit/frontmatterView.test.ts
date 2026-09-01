import { expect, test } from "playwright/test";
import { markdownToJsonContent } from "../../src/lib/export/markdown/parse/block";
import { jsonContentToMarkdown } from "../../src/lib/export/markdown/serialize";
import { mergeSettingsIntoFrontmatterHeader } from "../../src/lib/local-frontmatter";
import { importFromMarkdown } from "../../src/lib/export";

test.describe("yaml-frontmatter roundtrip", () => {
  test("pearl 风格 SKILL.md 头部 frontmatter 解析为 yaml-frontmatter 代码块并可导出", () => {
    const rawMd = [
      "---",
      "name: pearl",
      "description: 覆盖 PR 全链路：审查远程 GitHub、GitLab 或 Gitee 的 PR/MR",
      "goose-font: serif",
      "---",
      "",
      "# Pearl",
      "正文内容",
    ].join("\n");

    const parsed = markdownToJsonContent(rawMd);
    expect(parsed[0].type).toBe("codeBlock");
    expect(parsed[0].props.language).toBe("yaml-frontmatter");
    // 编辑器首块能看到 name / description，不再被扣下。
    expect(parsed[0].content).toContain("name: pearl");
    expect(parsed[0].content).toContain("description: 覆盖 PR 全链路");

    const exportedMd = jsonContentToMarkdown(parsed);
    // 写回首段「---」头，而不是 ```yaml-frontmatter 代码围栏。
    expect(exportedMd.startsWith("---\n")).toBe(true);
    expect(exportedMd.startsWith("```")).toBe(false);
    expect(exportedMd).toContain("name: pearl");
    expect(exportedMd).toContain("goose-font: serif");
    expect(exportedMd).toContain("# Pearl");
    // 不产生两份 frontmatter。
    expect(exportedMd.match(/^---$/gm)).toHaveLength(2);
  });

  test("editor 改完 YAML 写盘仍是单段 --- 头（roundtrip 收敛）", () => {
    const rawMd = [
      "---",
      "name: pearl",
      "description: 原描述",
      "---",
      "",
      "# Pearl",
      "正文",
    ].join("\n");

    const firstPass = jsonContentToMarkdown(markdownToJsonContent(rawMd));
    const secondPass = jsonContentToMarkdown(
      markdownToJsonContent(firstPass),
    );
    expect(secondPass).toBe(firstPass);
    expect(secondPass.match(/^---$/gm)).toHaveLength(2);
    expect(secondPass.startsWith("---\n")).toBe(true);
  });

  test("无 frontmatter 的 markdown 不凭空造 --- 头", () => {
    const rawMd = "# Pearl\n\n正文内容";
    const parsed = markdownToJsonContent(rawMd);
    expect(parsed[0].type).not.toBe("codeBlock");
    const exportedMd = jsonContentToMarkdown(parsed);
    expect(exportedMd.startsWith("---\n")).toBe(false);
  });

  test("scanner 用的 importFromMarkdown 保留 yaml-frontmatter 首块", () => {
    const rawMd = [
      "---",
      "name: pearl",
      "description: PR 全链路",
      "---",
      "",
      "# Pearl",
      "正文",
    ].join("\n");
    const res = importFromMarkdown(rawMd, "Pearl", { preserveStructure: true });
    expect(res.success).toBe(true);
    expect(res.content[0]?.type).toBe("codeBlock");
    expect(res.content[0]?.props?.language).toBe("yaml-frontmatter");
    expect(JSON.stringify(res.content[0]?.content)).toContain("name: pearl");
    expect(JSON.stringify(res.content[0]?.content)).toContain("description: PR 全链路");
  });

  test("pearl SKILL.md 保存：goose 设置 merge 进首块 YAML，仍是单段合法头", () => {
    const rawMd = [
      "---",
      "name: pearl",
      "description: 原描述",
      "---",
      "",
      "# Pearl",
      "正文内容",
    ].join("\n");

    // 打开：frontmatter 进入编辑器首块 yaml-frontmatter。
    const parsed = markdownToJsonContent(rawMd);
    // 用户编辑：往首块 YAML 追加一个键（模拟改 description）。
    parsed[0].content = "name: pearl\ndescription: 新描述\ntags:\n  - git\n";

    // 写盘：正文序列化后（首块已是 --- 头），用 goose 设置 merge，不应产生双头。
    const bodyMd = jsonContentToMarkdown(parsed);
    const merged = mergeSettingsIntoFrontmatterHeader(bodyMd, {
      fontFamily: "serif",
      isLocked: true,
      isPinned: false,
      isFavorite: false,
    });
    expect(merged).not.toBeNull();
    const saved = merged!.markdown;

    // 只有一对 --- 定界（单头），不出现 ```yaml-frontmatter 围栏。
    expect(saved.match(/^---$/gm)).toHaveLength(2);
    expect(saved.startsWith("---\n")).toBe(true);
    expect(saved.startsWith("```")).toBe(false);
    // 用户键保留，goose 设置 merge 成功。
    expect(saved).toContain("name: pearl");
    expect(saved).toContain("description: 新描述");
    expect(saved).toContain("tags:");
    expect(saved).toContain("goose-font: serif");
    expect(saved).toContain("goose-locked: true");
    // 正文仍在。
    expect(saved).toContain("# Pearl");
    // 再解析一次仍能收敛，证明是合法 YAML 头。
    const reparsed = markdownToJsonContent(saved);
    expect(reparsed[0].type).toBe("codeBlock");
    expect(reparsed[0].props.language).toBe("yaml-frontmatter");
  });
});
