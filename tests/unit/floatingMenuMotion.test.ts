import { expect, test } from "playwright/test";
import {
  floatingMenuFromTransform,
  floatingMenuMotionStyle,
  floatingMenuOrigin,
} from "../../src/components/ui/floating-menu-motion";

test("菜单从触发边长出：origin 和位移跟 placement 对齐", () => {
  expect(floatingMenuOrigin("bottom-end")).toBe("top right");
  expect(floatingMenuOrigin("right-start")).toBe("left top");
  expect(floatingMenuOrigin("top")).toBe("bottom center");
  expect(floatingMenuFromTransform("right")).toBe(
    "translateX(-6px) scale(0.96)",
  );
  expect(floatingMenuFromTransform("bottom")).toBe(
    "translateY(-6px) scale(0.96)",
  );
});

test("指针打开有位移缩放，键盘打开即时，reduced 只留淡入", () => {
  const pointerOpen = floatingMenuMotionStyle("open", "bottom-end", "full");
  expect(pointerOpen.opacity).toBe(1);
  expect(pointerOpen.transform).toBe("translate(0px, 0px) scale(1)");
  expect(pointerOpen.transitionDuration).toBe("200ms");
  expect(pointerOpen.transformOrigin).toBe("top right");

  const pointerClosed = floatingMenuMotionStyle("close", "right-start", "full");
  expect(pointerClosed.opacity).toBe(0);
  expect(pointerClosed.transform).toBe("translateX(-6px) scale(0.96)");
  expect(pointerClosed.transitionDuration).toBe("150ms");
  expect(pointerClosed.transitionTimingFunction).toBe("ease-in");

  const keyboardOpen = floatingMenuMotionStyle("initial", "bottom", "instant");
  expect(keyboardOpen.opacity).toBe(1);
  expect(keyboardOpen.transitionDuration).toBe("0ms");

  const reduced = floatingMenuMotionStyle("close", "bottom", "reduced");
  expect(reduced.transform).toBe("none");
  expect(reduced.transitionProperty).toBe("opacity");
});

test("点开的右键菜单不位移，只从点击处缩放", () => {
  const closed = floatingMenuMotionStyle("initial", "bottom-start", "full", {
    shift: false,
  });
  expect(closed.transform).toBe("scale(0.96)");
  expect(closed.transformOrigin).toBe("top left");
});
