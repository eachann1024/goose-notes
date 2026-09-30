import { expect, test } from "playwright/test";
import { createQuicknoteActivateSuppression } from "../../electron/main/quicknoteActivateSuppression";

test("速记窗引起的 activate 在 TTL 内全部抑制", () => {
  const now = 100;
  const suppression = createQuicknoteActivateSuppression(1_500, () => now);

  expect(suppression.shouldSuppress()).toBe(false);
  suppression.mark();
  expect(suppression.shouldSuppress()).toBe(true);
  expect(suppression.shouldSuppress()).toBe(true);
});

test("未出现 activate 时关闭抑制令牌会过期", () => {
  let now = 100;
  const suppression = createQuicknoteActivateSuppression(1_500, () => now);

  suppression.mark();
  now = 1_601;
  expect(suppression.shouldSuppress()).toBe(false);
});
