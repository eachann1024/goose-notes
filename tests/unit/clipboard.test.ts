import { expect, test } from "playwright/test";
import {
  htmlHasNonDefaultGooseBlockAttrs,
  htmlHasPreservableFormatting,
  normalizeClipboardListMarkers,
} from "../../src/components/editor/utils/clipboard";

test("复制无序列表使用短横线，保留嵌套、格式、代码与分隔线", () => {
  const source = "* **项目**\n  * 子项\n\n> * 引用列表\n\n+ 项目\n\n1. 有序\n\n***\n\n```md\n* 代码\n```\n\n    * 缩进代码\n\n`* 行内代码`";
  expect(normalizeClipboardListMarkers(source)).toBe(
    "- **项目**\n  - 子项\n\n> - 引用列表\n\n- 项目\n\n1. 有序\n\n***\n\n```md\n* 代码\n```\n\n    * 缩进代码\n\n`* 行内代码`",
  );
});

test("htmlHasNonDefaultGooseBlockAttrs 空 html 为 false", () => {
  expect(htmlHasNonDefaultGooseBlockAttrs("")).toBe(false);
  expect(htmlHasNonDefaultGooseBlockAttrs("   ")).toBe(false);
});

test("htmlHasNonDefaultGooseBlockAttrs 仅非 default 块属性为 true", () => {
  expect(
    htmlHasNonDefaultGooseBlockAttrs(
      '<p data-background-color="#ffeeaa">块背景</p>',
    ),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-color="red">字色</p>'),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-alignment="center">居中</p>'),
  ).toBe(true);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-background-color="default">x</p>'),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-color="DEFAULT">x</p>'),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<p data-text-alignment="left">x</p>'),
  ).toBe(false);
});

test("htmlHasNonDefaultGooseBlockAttrs 不因 strong/span 为 true", () => {
  expect(
    htmlHasNonDefaultGooseBlockAttrs("<p><strong>加粗</strong></p>"),
  ).toBe(false);
  expect(
    htmlHasNonDefaultGooseBlockAttrs('<span style="color: red">红字</span>'),
  ).toBe(false);
});

test("htmlHasPreservableFormatting 空 html 为 false", () => {
  expect(htmlHasPreservableFormatting("")).toBe(false);
  expect(htmlHasPreservableFormatting("   ")).toBe(false);
});

test("htmlHasPreservableFormatting 识别行内标签", () => {
  expect(htmlHasPreservableFormatting("<p><strong>加粗</strong></p>")).toBe(
    true,
  );
  expect(htmlHasPreservableFormatting("<p><mark>高亮</mark></p>")).toBe(true);
  expect(htmlHasPreservableFormatting("<p>纯文本</p>")).toBe(false);
});

test("htmlHasPreservableFormatting 识别 Goose 块属性与 style 颜色", () => {
  expect(
    htmlHasPreservableFormatting(
      '<p data-background-color="#ffeeaa">块背景</p>',
    ),
  ).toBe(true);
  expect(
    htmlHasPreservableFormatting('<span style="color: red">红字</span>'),
  ).toBe(true);
  expect(
    htmlHasPreservableFormatting(
      '<p style="background-color: yellow">黄底</p>',
    ),
  ).toBe(true);
});

test("htmlHasPreservableFormatting 识别标题与引用", () => {
  expect(htmlHasPreservableFormatting("<h2>标题</h2>")).toBe(true);
  expect(htmlHasPreservableFormatting("<blockquote>引用</blockquote>")).toBe(
    true,
  );
});
