import { expect, test } from "playwright/test";
import {
  applyAppearanceScaleVariables,
  clearStartupSettling,
  markStartupSettling,
} from "../../src/lib/appearance";

// 单元测试运行在 Node 环境，这里用最小 document 桩验证 DOM 写入逻辑。
const createDocumentStub = () => {
  const styleProps = new Map<string, string>();
  const attrs = new Set<string>();
  const stub = {
    documentElement: {
      style: {
        setProperty: (name: string, value: string) =>
          void styleProps.set(name, value),
        getPropertyValue: (name: string) => styleProps.get(name) ?? "",
        set fontSize(value: string) {
          styleProps.set("font-size", value);
        },
        get fontSize() {
          return styleProps.get("font-size") ?? "";
        },
      },
      setAttribute: (name: string) => void attrs.add(name),
      removeAttribute: (name: string) => void attrs.delete(name),
      hasAttribute: (name: string) => attrs.has(name),
    },
  };
  return stub;
};

let stub: ReturnType<typeof createDocumentStub>;
const root = () => stub.documentElement;

test.beforeEach(() => {
  stub = createDocumentStub();
  (globalThis as Record<string, unknown>).document = stub;
});

test.afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
});

test("首帧前同步写入界面字号与编辑器缩放变量", () => {
  applyAppearanceScaleVariables({ uiFontSize: "normal", editorFontSize: 13 });

  expect(root().style.fontSize).toBe("16px");
  expect(root().style.getPropertyValue("--editor-font-size")).toBe("13px");
  // 13 / 16（默认字号）= 0.8125，首帧即恢复上次缩放而非默认 1
  expect(root().style.getPropertyValue("--editor-scale")).toBe("0.8125");
});

test("未知界面字号回退到 small，避免启动时字体缺省跳变", () => {
  applyAppearanceScaleVariables({
    // 模拟旧版本持久化里残留的非法值
    uiFontSize: "huge" as never,
    editorFontSize: 16,
  });

  expect(root().style.fontSize).toBe("14px");
  expect(root().style.getPropertyValue("--editor-scale")).toBe("1.0000");
});

test("启动过渡禁用标记可写入并幂等清除", () => {
  markStartupSettling();
  expect(root().hasAttribute("data-startup-settling")).toBe(true);
  clearStartupSettling();
  clearStartupSettling();
  expect(root().hasAttribute("data-startup-settling")).toBe(false);
});
