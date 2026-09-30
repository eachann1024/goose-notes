import { expect, test } from "playwright/test";
import { matchQuoteTrigger } from "../../src/components/editor/inputrules/markdownInputRules";

test("> ＞ | ｜ 可触发引用", () => {
  expect(matchQuoteTrigger(">")).toEqual({ triggerText: ">" });
  expect(matchQuoteTrigger("＞")).toEqual({ triggerText: "＞" });
  expect(matchQuoteTrigger("|")).toEqual({ triggerText: "|" });
  expect(matchQuoteTrigger("｜")).toEqual({ triggerText: "｜" });
});

test("》 引号 >> >x 空串不触发引用", () => {
  expect(matchQuoteTrigger("》")).toBeNull();
  expect(matchQuoteTrigger('"')).toBeNull();
  expect(matchQuoteTrigger(">>")).toBeNull();
  expect(matchQuoteTrigger(">x")).toBeNull();
  expect(matchQuoteTrigger("")).toBeNull();
});
