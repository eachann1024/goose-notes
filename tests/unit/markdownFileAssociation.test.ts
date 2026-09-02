import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  collectMarkdownPathsFromArgv,
  isMarkdownDocumentPath,
} from "../../electron/main/markdownOpenPaths";

test("recognizes markdown document paths across platforms", () => {
  expect(isMarkdownDocumentPath("/notes/hello.md")).toBe(true);
  expect(isMarkdownDocumentPath("C:\\notes\\Hello.MD")).toBe(true);
  expect(isMarkdownDocumentPath("/notes/readme.markdown")).toBe(true);
  expect(isMarkdownDocumentPath("/notes/readme.txt")).toBe(false);
  expect(isMarkdownDocumentPath("/notes/readme.md.bak")).toBe(false);
});

test("packaged argv keeps markdown files and skips flags", () => {
  expect(
    collectMarkdownPathsFromArgv(
      [
        "/opt/Goose Note/goose-note",
        "--started-from-shortcut",
        "/notes/a.md",
        "/notes/b.markdown",
        "/notes/skip.txt",
      ],
      {
        packaged: true,
        execPath: "/opt/Goose Note/goose-note",
      },
    ),
  ).toEqual(["/notes/a.md", "/notes/b.markdown"]);
});

test("dev argv skips electron binary and main script", () => {
  expect(
    collectMarkdownPathsFromArgv(
      [
        "/usr/local/bin/electron",
        "dist-electron/main/index.js",
        "/tmp/note.md",
        "--inspect",
      ],
      { packaged: false, execPath: "/usr/local/bin/electron" },
    ),
  ).toEqual(["/tmp/note.md"]);
});

test("desktop packagers declare markdown file associations for mac/win/linux", () => {
  const packer = readFileSync(
    new URL("../../scripts/prepare-electron-pack.mjs", import.meta.url),
    "utf8",
  );
  const builderYml = readFileSync(
    new URL("../../electron-builder.yml", import.meta.url),
    "utf8",
  );
  const pluginJson = readFileSync(
    new URL("../../plugin.json", import.meta.url),
    "utf8",
  );
  for (const source of [packer, builderYml]) {
    expect(source).toContain("fileAssociations:");
    expect(source).toContain("ext: md");
    expect(source).toContain("ext: markdown");
    expect(source).toContain("mimeType: text/markdown");
    expect(source).toContain("MimeType: text/markdown;text/x-markdown;");
  }
  expect(pluginJson).toContain('fileType": "file"');
  expect(pluginJson).toContain(".(md|markdown)$");
});
