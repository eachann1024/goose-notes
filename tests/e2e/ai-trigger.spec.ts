import { expect, test } from "playwright/test";
import { bootApp, createPageFromSidebar, writeNote } from "./helpers";

test.describe("AI 交互流程", () => {
  test("划选文本触发润色，然后应用并验收", async ({ page }) => {
    // Enable AI mock configuration if necessary, we assume helper has utools.ai mock
    await bootApp(page);
    await createPageFromSidebar(page);
    
    // 我们先要把全局的 AI 设置为 true（因为代码中有关闭不显示逻辑）
    // 为了简单起见，我们通过 localStorage 修改 AI 配置或者依赖默认设为 true 可行
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("goose-note-settings") || "{}");
      if (!state.state) state.state = {};
      if (!state.state.ai) state.state.ai = {};
      state.state.ai.enabled = true;
      localStorage.setItem("goose-note-settings", JSON.stringify(state));
    });
    // 刷新一下或者直接使用，因为 localStorage 更新可能需要重载
    await page.reload();
    
    const title = "AI 测篇";
    const body = "这是一段需要被改写或润色的测试笔记文字。";
    await writeNote(page, title, body);

    // 选中刚才填写的 body
    const editor = page.locator(".ProseMirror").first();
    await editor.locator("text=" + body).dblclick();

    // 应该会浮出 `AI 润色` 按钮
    const polishButton = page.locator('button[aria-label="AI 润色"]');
    await expect(polishButton).toBeVisible();

    // 点击按钮
    await polishButton.click();

    // 应该弹出 AiInputPopover
    const aiInput = page.getByPlaceholder("输入自定义润色要求...");
    await expect(aiInput).toBeVisible();

    // 回车，触发跑模型代码
    await aiInput.press("Enter");

    // 此时应该出现 review 操作面板
    await expect(page.locator("text=AI 结果已生成")).toBeVisible();

    // 点击 应用
    const applyButton = page.getByRole("button", { name: "应用" });
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    // 检查结果是否变成了模拟的内容
    await expect(page.locator(".ProseMirror").first()).toContainText("模拟的 AI 结果");
  });
});
