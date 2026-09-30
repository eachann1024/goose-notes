import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  FIND_SEED_MAX_LENGTH,
  normalizeFindSeed,
  readEditorFindSeed,
} from "../../src/components/editor/find/findSeed";

test("normalizeFindSeed 去掉首尾空白并把换行收成空格", () => {
  expect(normalizeFindSeed("  hello  ")).toBe("hello");
  expect(normalizeFindSeed("hello\nworld")).toBe("hello world");
  expect(normalizeFindSeed("foo\r\nbar\nbaz")).toBe("foo bar baz");
  expect(normalizeFindSeed("   \n  ")).toBe("");
});

test("normalizeFindSeed 截断过长选区", () => {
  const raw = "a".repeat(FIND_SEED_MAX_LENGTH + 40);
  const seeded = normalizeFindSeed(raw);
  expect(seeded).toHaveLength(FIND_SEED_MAX_LENGTH);
  expect(seeded).toBe("a".repeat(FIND_SEED_MAX_LENGTH));
});

test("readEditorFindSeed 优先用 BlockNote 选区", () => {
  expect(
    readEditorFindSeed({
      getSelectedText: () => "  选中的词  ",
    }),
  ).toBe("选中的词");
});

test("readEditorFindSeed 选区为空时返回空字符串", () => {
  expect(
    readEditorFindSeed({
      getSelectedText: () => "",
    }),
  ).toBe("");
  expect(readEditorFindSeed(null)).toBe("");
});

test("打开页内查找时会把当前选区写入查找框", () => {
  const composer = readFileSync(
    new URL("../../src/components/editor/core/EditorComposer.tsx", import.meta.url),
    "utf8",
  );
  const findBar = readFileSync(
    new URL("../../src/components/editor/find/FindInPageBar.tsx", import.meta.url),
    "utf8",
  );

  expect(composer).toContain("readEditorFindSeed");
  expect(composer).toContain("goose-note:editor-find-open");
  expect(composer).toContain("seedQuery={findSeedQuery}");
  expect(composer).toContain("openReplace={findOpenReplace}");
  expect(findBar).toContain("seedQuery");
  expect(findBar).toContain("if (seedQuery && seedQuery !== query)");
  expect(findBar).toContain("setQuery(seedQuery)");
});

test("查找栏在标题栏下方，并可展开替换与全部替换", () => {
  const findBar = readFileSync(
    new URL("../../src/components/editor/find/FindInPageBar.tsx", import.meta.url),
    "utf8",
  );
  const composer = readFileSync(
    new URL("../../src/components/editor/core/EditorComposer.tsx", import.meta.url),
    "utf8",
  );
  const hotkeys = readFileSync(
    new URL("../../src/hooks/useAppHotkeys.ts", import.meta.url),
    "utf8",
  );

  expect(findBar).toContain("--electron-titlebar-height");
  expect(findBar).toContain("展开替换");
  expect(findBar).toContain("全部替换");
  expect(findBar).toContain("replaceCurrentMatch");
  expect(findBar).toContain("replaceAllMatches");
  expect(composer).toContain('detail?.replace === true');
  expect(hotkeys).toContain('matchShortcut(event, "Mod+Alt+F")');
  expect(hotkeys).toContain("replace: true");
});
