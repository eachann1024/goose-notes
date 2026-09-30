import { expect, test } from "bun:test";
import { isValidElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { createPdfBlockMappings } from "./blockMappings";
import {
  createPdfDocument,
  renderPdfInline,
  tableColumnPercentages,
} from "./renderer";
import { registerPdfFonts } from "./fontConfig";

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements(node.props.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
const inline = (value) => [{ type: "text", text: value, styles: {} }];
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";

test("inline styles, safe links, line breaks and mentions survive", () => {
  const nodes = renderPdfInline([
    {
      type: "text",
      text: "styled",
      styles: {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
        code: true,
        textColor: "red",
        backgroundColor: "yellow",
      },
    },
    { type: "hardBreak" },
    { type: "pageMention", props: { title: "笔记" } },
    { type: "link", href: "https://example.com", content: inline("safe") },
    { type: "link", href: "file:///private/secret", content: inline("local") },
  ]);
  expect(text(nodes)).toBe("styled\n@笔记safelocal");
  const leaves = elements(nodes);
  expect(leaves[0].props.style).toMatchObject({
    fontWeight: 700,
    fontStyle: "italic",
    textDecoration: "underline line-through",
    color: "#dc2626",
    backgroundColor: "#fef9c3",
  });
  expect(
    leaves.filter((node) => node.props.src).map((node) => node.props.src),
  ).toEqual(["https://example.com"]);
});

test("ordered list starts, interruptions and nested lists have independent numbering", async () => {
  const mappings = await createPdfBlockMappings();
  const blocks = [
    {
      type: "numberedListItem",
      props: { start: 4 },
      content: inline("parent"),
      children: [{ type: "numberedListItem", content: inline("child") }],
    },
    { type: "numberedListItem", content: inline("next") },
    { type: "paragraph", content: inline("break") },
    { type: "numberedListItem", content: inline("restart") },
    {
      type: "checkListItem",
      props: { checked: true },
      content: inline("done"),
    },
  ];
  const doc = await createPdfDocument(blocks, mappings, "Helvetica");
  expect(text(doc)).toBe("4.parent1.child5.nextbreak1.restart[x]done");
  expect(
    elements(doc).some((node) => node.props.style?.marginLeft === 18),
  ).toBe(true);
});

test("tables normalize widths and retain old/new cells, header and long text", async () => {
  expect(tableColumnPercentages([100, 300], 2)).toEqual([25, 75]);
  expect(tableColumnPercentages([undefined, NaN], 2)).toEqual([50, 50]);
  const mappings = await createPdfBlockMappings();
  const long = "中文内容".repeat(80) + "UnbrokenEnglishToken".repeat(50);
  const doc = await createPdfDocument(
    [
      {
        type: "table",
        content: {
          columnWidths: [100, 300],
          headerRows: 1,
          rows: [
            {
              cells: [
                inline("label"),
                {
                  type: "tableCell",
                  props: { textAlignment: "right" },
                  content: inline(long),
                },
              ],
            },
          ],
        },
      },
    ],
    mappings,
    "Helvetica",
  );
  expect(text(doc)).toBe("label" + long);
  expect(
    elements(doc)
      .filter((node) => node.props.style?.width)
      .map((node) => node.props.style.width),
  ).toEqual(["25%", "75%"]);
  const cell = elements(doc).find((node) => node.props.hyphenationCallback);
  expect(cell?.props.hyphenationCallback("中文ABC")).toEqual([
    "中",
    "文",
    "A",
    "B",
    "C",
  ]);
});

test("visual mappings resolve local assets and never hand unsafe URLs to PDF", async () => {
  const seen = [];
  const mappings = await createPdfBlockMappings({
    pageLocalFilePath: "/notes/page.md",
    resolveImageSrc: async (...args) => {
      seen.push(args);
      return png;
    },
    renderMathPng: async () => png,
    renderMermaidPng: async () => png,
  });
  const doc = await createPdfDocument(
    [
      {
        type: "image",
        props: { url: "file:///notes/picture.png", caption: "caption" },
      },
      {
        type: "codeBlock",
        props: { language: "math" },
        content: inline("x^2"),
      },
      {
        type: "codeBlock",
        props: { language: "mermaid" },
        content: inline("graph TD;A-->B"),
      },
      {
        type: "file",
        props: { url: "file:///notes/secret", name: "attachment" },
      },
    ],
    mappings,
    "Helvetica",
  );
  expect(seen).toEqual([["file:///notes/picture.png", "/notes/page.md"]]);
  expect(
    elements(doc)
      .filter((node) => node.props.src)
      .map((node) => node.props.src),
  ).toEqual([png, png, png]);
  expect(text(doc)).not.toContain("graph TD");
  expect(text(doc)).toContain("attachment");
});

test("failed visual conversions retain source and caption", async () => {
  const mappings = await createPdfBlockMappings({
    resolveImageSrc: async () => "https://unsafe.test/image.png",
    renderMathPng: async () => null,
  });
  const doc = await createPdfDocument(
    [
      { type: "image", props: { url: "x", caption: "missing" } },
      {
        type: "codeBlock",
        props: { language: "math" },
        content: inline("x^2"),
      },
    ],
    mappings,
    "Helvetica",
  );
  expect(elements(doc).filter((node) => node.props.src)).toHaveLength(0);
  expect(text(doc)).toContain("missing");
  expect(text(doc)).toContain("x^2");
});

test("real PDF generation paginates long tables", async () => {
  const mappings = await createPdfBlockMappings();
  const doc = await createPdfDocument(
    [
      { type: "heading", props: { level: 1 }, content: inline("PDF fallback") },
      {
        type: "table",
        content: {
          columnWidths: [1, 3],
          rows: Array.from({ length: 80 }, (_, i) => ({
            cells: [
              inline(String(i)),
              inline("LongUnbrokenEnglishText".repeat(8)),
            ],
          })),
        },
      },
    ],
    mappings,
    "Helvetica",
  );
  const blob = await pdf(doc).toBlob();
  const bytes = Buffer.from(await blob.arrayBuffer());
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(5000);
  expect(
    bytes.toString("latin1").match(/\/Type \/Page\b/g).length,
  ).toBeGreaterThan(1);
}, 20000);

// Opt-in network evidence exercises the unchanged font loader and actual CJK embedding.
test.skipIf(!process.env.PDF_CJK_EVIDENCE)(
  "generate CJK fixture using fontConfig",
  async () => {
    const fonts = await registerPdfFonts({ fontFamily: "mono" });
    expect(fonts.ready).toBe(true);
    const mappings = await createPdfBlockMappings({
      resolveImageSrc: async () => png,
      renderMathPng: async () => png,
      renderMermaidPng: async () => png,
    });
    const doc = await createPdfDocument(
      [
        { type: "heading", content: inline("中文 PDF 导出验收") },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "粗体斜体下划线删除线",
              styles: {
                bold: true,
                italic: true,
                underline: true,
                strike: true,
              },
            },
            { type: "pageMention", props: { title: "关联笔记" } },
          ],
        },
        {
          type: "callout",
          props: { icon: "Lightbulb" },
          content: inline("提示：中文字体保留，子块缩进。"),
          children: [{ type: "bulletListItem", content: inline("中文列表") }],
        },
        {
          type: "codeBlock",
          props: { language: "javascript" },
          content: inline('const label = "中文代码";'),
        },
        { type: "divider" },
        {
          type: "table",
          content: {
            columnWidths: [100, 300],
            headerRows: 1,
            rows: [
              { cells: [inline("名称"), inline("说明")] },
              ...Array.from({ length: 12 }, (_, i) => ({
                cells: [
                  inline(`项目 ${i + 1}`),
                  inline(
                    "中英文长文本验证 MixedEnglishTokenWithoutSpaces".repeat(8),
                  ),
                ],
              })),
            ],
          },
        },
      ],
      mappings,
      fonts.pageFontFamily,
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(10000);
    await Bun.write(process.env.PDF_CJK_EVIDENCE, blob);
  },
  60000,
);
