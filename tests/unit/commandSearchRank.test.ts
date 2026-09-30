import { expect, test } from "playwright/test";
import {
  compareTitleMatchRank,
  titleMatchRank,
} from "../../src/pages/workspace/components/command/commandSearchRank";

test("标题全匹配优先于仅正文/模糊命中", () => {
  expect(titleMatchRank("wship", "wship")).toBe(0);
  expect(titleMatchRank("wship 超级原子提交", "wship")).toBe(1);
  expect(titleMatchRank("ship", "wship")).toBe(3);
  expect(titleMatchRank("SKILL", "wship")).toBe(3);

  const titles = [
    "bundle-barrel-imports",
    "client",
    "ship",
    "SKILL",
    "wship",
  ];
  const sorted = [...titles].sort((a, b) => compareTitleMatchRank(a, b, "wship"));
  expect(sorted[0]).toBe("wship");
});
