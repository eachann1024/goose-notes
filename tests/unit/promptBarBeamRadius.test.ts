import { expect, test } from "playwright/test";
import { promptBarBeamRadius } from "../../src/pages/workspace/components/notebook-ai/beautiful-ui/promptBarBeamRadius";

test("单行胶囊用正圆端帽，而不是按宽高各自对半的椭圆", () => {
  const radius = promptBarBeamRadius({
    width: 600,
    height: 44,
    expanded: false,
  });
  expect(radius).toBe(21);
  expect(radius).toBeLessThan(600 / 2);
});

test("多行展开态贴合 20px 外壳的内沿", () => {
  expect(
    promptBarBeamRadius({
      width: 600,
      height: 88,
      expanded: true,
    }),
  ).toBe(19);
});

test("极窄时不超过半短边，避免再次被钳成椭圆", () => {
  expect(
    promptBarBeamRadius({
      width: 30,
      height: 44,
      expanded: false,
    }),
  ).toBe(14);
});
