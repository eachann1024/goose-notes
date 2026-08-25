import { expect, test } from "playwright/test";
import {
  isRandomPageIcon,
  pickRandomPageIcon,
} from "../../src/lib/randomPageIcon";

test("随机页面图标来自可选池", () => {
  for (let i = 0; i < 20; i += 1) {
    expect(isRandomPageIcon(pickRandomPageIcon())).toBe(true);
  }
});
