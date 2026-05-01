import { expect, test } from "@playwright/test";

test("BlockNote editor supports click and typing flow", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".bn-editor").first();
  await expect(editor).toBeVisible();

  const blocks = page.locator(".bn-block-content");
  await blocks.last().click();
  await page.keyboard.type("BlockNote e2e click flow");

  await expect(editor).toContainText("BlockNote e2e click flow");
});
