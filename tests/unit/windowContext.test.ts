import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  gooseWindowAdditionalArguments,
  parseGooseWindowArgs,
  readWindowContextFromArgv,
  tabsPersistKey,
} from "../../src/lib/electron/windowContext";

test("parses goose window id and kind from additionalArguments", () => {
  expect(
    parseGooseWindowArgs([
      "--type=renderer",
      "--goose-window-id=abc-123",
      "--goose-window-kind=workspace",
    ]),
  ).toEqual({ windowId: "abc-123", kind: "workspace" });
  expect(
    parseGooseWindowArgs(gooseWindowAdditionalArguments("qn-1", "quicknote")),
  ).toEqual({ windowId: "qn-1", kind: "quicknote" });
});

test("rejects incomplete or unknown window argv", () => {
  expect(parseGooseWindowArgs(["--goose-window-id=only-id"])).toBeNull();
  expect(parseGooseWindowArgs(["--goose-window-kind=workspace"])).toBeNull();
  expect(
    parseGooseWindowArgs([
      "--goose-window-id=abc",
      "--goose-window-kind=popup",
    ]),
  ).toBeNull();
});

test("readWindowContextFromArgv uses the supplied argv list", () => {
  expect(
    readWindowContextFromArgv([
      "--goose-window-id=w1",
      "--goose-window-kind=workspace",
    ]),
  ).toEqual({ windowId: "w1", kind: "workspace" });
});

test("tabs persist key is scoped per window id", () => {
  expect(tabsPersistKey("abc-123")).toBe("goose-note:open-tabs:v1:abc-123");
});

test("主进程 additionalArguments 与渲染层共用同一套 argv 前缀", () => {
  const windows = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  expect(windows).toContain("gooseWindowAdditionalArguments");
  expect(windows).not.toContain("`--goose-window-id=${windowId}`");
});
