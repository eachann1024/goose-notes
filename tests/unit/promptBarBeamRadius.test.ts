import { expect, test } from "playwright/test";
import { promptBarBeamRadius } from "../../src/pages/workspace/components/notebook-ai/beautiful-ui/promptBarBeamRadius";

test("单行贴合 8px 外壳的内沿，不再用胶囊正圆端帽", () => {
  const radius = promptBarBeamRadius({
    width: 600,
    height: 44,
  });
  expect(radius).toBe(7);
  expect(radius).toBeLessThan(44 / 2);
});

test("多行展开态同样贴合 8px 外壳的内沿", () => {
  expect(
    promptBarBeamRadius({
      width: 600,
      height: 88,
    }),
  ).toBe(7);
});

test("极窄时不超过半短边，避免再次被钳成椭圆", () => {
  expect(
    promptBarBeamRadius({
      width: 10,
      height: 44,
    }),
  ).toBe(4);
});
