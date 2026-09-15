import { expect, test } from "playwright/test";

test("saves the current draft into the open notebook and resets the slot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 408, height: 759 });
  await page.goto("/quicknote.html?e2eLocalMock");
  await page.waitForFunction(() => Boolean((window as any).__gooseTest));
  await page.evaluate(async () => {
    await (window as any).__gooseTest.setupMockNotebook();
  });

  const saveButton = page.getByRole("button", { name: "保存到笔记" });
  await expect(saveButton).toBeDisabled();

  const editor = page.getByRole("textbox").first();
  await editor.click();
  await editor.fill("会议纪要");
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByText("已保存到笔记")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "便签 1，空白" }),
  ).toBeChecked();
  await expect(saveButton).toBeDisabled();

  const saved = await page.evaluate(() =>
    (window as any).__gooseTest.readMockFile("/mock-notes/会议纪要.md"),
  );
  expect(saved).toBeTruthy();
  expect(saved).toContain("会议纪要");
});
