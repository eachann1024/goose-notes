import { expect, test } from "playwright/test";
import {
  GOOSE_FONT_KEY,
  GOOSE_LOCKED_KEY,
  applyFrontmatterBodyToContent,
  frontmatterBodyHasUserVisibleKeys,
  isLocalPageFrontmatterSettingsUpdate,
  mergeLocalPageSettingsIntoFrontmatter,
  parseLocalFrontmatterBlob,
  pageSettingsFromMarkdown,
} from "../../src/lib/local-frontmatter";

test.describe("local-frontmatter", () => {
  test("无 frontmatter 时 settings 为默认", () => {
    const parsed = parseLocalFrontmatterBlob(undefined);
    expect(parsed.ok).toBe(true);
    expect(parsed.settings).toEqual({
      fontFamily: "default",
      isLocked: false,
      isPinned: false,
      isFavorite: false,
    });
  });

  test("解析 goose-font / goose-locked / goose-pinned / goose-favorite 并保留未知键", () => {
    const blob = [
      "---",
      "title: 周会",
      "tags:",
      "  - meeting",
      `${GOOSE_FONT_KEY}: serif`,
      `${GOOSE_LOCKED_KEY}: true`,
      "goose-pinned: true",
      "goose-favorite: true",
      "---",
    ].join("\n");
    const parsed = parseLocalFrontmatterBlob(blob);
    expect(parsed.ok).toBe(true);
    expect(parsed.settings).toEqual({
      fontFamily: "serif",
      isLocked: true,
      isPinned: true,
      isFavorite: true,
    });
    expect(parsed.data.title).toBe("周会");
    expect(parsed.data.tags).toEqual(["meeting"]);
  });

  test("非法 goose-font 回退 default", () => {
    const blob = `---\n${GOOSE_FONT_KEY}: comic-sans\n---`;
    const parsed = parseLocalFrontmatterBlob(blob);
    expect(parsed.ok).toBe(true);
    expect(parsed.settings.fontFamily).toBe("default");
  });

  test("坏 YAML 不 ok，settings 默认", () => {
    const blob = "---\n: [oops\n---";
    const parsed = parseLocalFrontmatterBlob(blob);
    expect(parsed.ok).toBe(false);
    expect(parsed.settings).toEqual({
      fontFamily: "default",
      isLocked: false,
      isPinned: false,
      isFavorite: false,
    });
  });

  test("merge：默认值省略且不创建空 frontmatter", () => {
    const result = mergeLocalPageSettingsIntoFrontmatter(undefined, {
      fontFamily: "default",
      isLocked: false,
      isPinned: false,
      isFavorite: false,
    });
    expect(result.parseFailed).toBe(false);
    expect(result.blob).toBeUndefined();
  });

  test("merge：写入非默认设置", () => {
    const result = mergeLocalPageSettingsIntoFrontmatter(undefined, {
      fontFamily: "mono",
      isLocked: true,
      isPinned: true,
      isFavorite: true,
    });
    expect(result.parseFailed).toBe(false);
    expect(result.blob).toContain("goose-font: mono");
    expect(result.blob).toContain("goose-locked: true");
    expect(result.blob).toContain("goose-pinned: true");
    expect(result.blob).toContain("goose-favorite: true");
    expect(result.blob?.startsWith("---")).toBe(true);
  });

  test("merge：保留用户键并去掉回退默认的 goose 键", () => {
    const existing = [
      "---",
      "title: keep-me",
      "goose-font: serif",
      "goose-locked: true",
      "goose-pinned: true",
      "goose-favorite: true",
      "---",
    ].join("\n");
    const result = mergeLocalPageSettingsIntoFrontmatter(existing, {
      fontFamily: "default",
      isLocked: false,
      isPinned: false,
      isFavorite: false,
    });
    expect(result.parseFailed).toBe(false);
    expect(result.blob).toContain("title: keep-me");
    expect(result.blob).not.toContain("goose-font");
    expect(result.blob).not.toContain("goose-locked");
    expect(result.blob).not.toContain("goose-pinned");
    expect(result.blob).not.toContain("goose-favorite");
  });

  test("merge：坏 YAML 原样保留", () => {
    const existing = "---\n: [broken\n---";
    const result = mergeLocalPageSettingsIntoFrontmatter(existing, {
      fontFamily: "serif",
      isLocked: true,
      isPinned: false,
      isFavorite: false,
    });
    expect(result.parseFailed).toBe(true);
    expect(result.blob).toBe(existing);
  });

  test("pageSettingsFromMarkdown 从全文读设置", () => {
    const md = [
      "---",
      "goose-font: serif",
      "goose-pinned: true",
      "---",
      "",
      "# hello",
    ].join("\n");
    expect(pageSettingsFromMarkdown(md)).toEqual({
      fontFamily: "serif",
      isLocked: false,
      isPinned: true,
      isFavorite: false,
    });
  });

  test("isLocalPageFrontmatterSettingsUpdate 识别白名单字段", () => {
    expect(isLocalPageFrontmatterSettingsUpdate({ fontFamily: "serif" })).toBe(
      true,
    );
    expect(isLocalPageFrontmatterSettingsUpdate({ isLocked: true })).toBe(true);
    expect(isLocalPageFrontmatterSettingsUpdate({ isPinned: true })).toBe(true);
    expect(isLocalPageFrontmatterSettingsUpdate({ isFavorite: true })).toBe(
      true,
    );
    expect(isLocalPageFrontmatterSettingsUpdate({ content: [] as any })).toBe(
      false,
    );
  });

  test("仅 goose 键不算用户可见属性", () => {
    expect(frontmatterBodyHasUserVisibleKeys("goose-favorite: true")).toBe(
      false,
    );
    expect(
      frontmatterBodyHasUserVisibleKeys("name: pearl\ngoose-favorite: true"),
    ).toBe(true);
  });

  test("applyFrontmatterBodyToContent 不为纯 goose YAML 插入首块", () => {
    const content = [{ type: "paragraph", content: "hi" }];
    const next = applyFrontmatterBodyToContent(
      content as any,
      "goose-favorite: true",
    ) as any[];
    expect(next[0]?.type).toBe("paragraph");
    expect(next.some((b) => b?.props?.language === "yaml-frontmatter")).toBe(
      false,
    );
  });
});
