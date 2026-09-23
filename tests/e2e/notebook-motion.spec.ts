import { expect, test, type Page } from 'playwright/test';

const menuSelector = '[data-goose-floating-content].goose-notebook-menu-surface';

async function boot(page: Page) {
  await page.goto('/?e2eLocalMock');
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const { notebookId } = await h.setupMockNotebook();
    const base = h.stores.useNotebooks.getState().notebooks[notebookId];
    h.stores.useNotebooks.setState({
      activeNotebookId: notebookId,
      notebooks: Object.fromEntries(Array.from({ length: 3 }, (_, i) => {
        const id = i ? `motion-mock-${i}` : notebookId;
        return [id, { ...base, id, name: `动效测试 ${i + 1}`, order: i }];
      })),
    });
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.getState().setNotebookDropdownHoverExpand(false);
  });
  const trigger = page.locator('.sidebar-notebook-trigger');
  const menu = page.locator(menuSelector);
  await expect(trigger).toBeVisible();
  return { trigger, menu };
}

test('切换后重开聚焦当前项，方向键只移动焦点，回车才切换', async ({ page }) => {
  const { trigger, menu } = await boot(page);
  await trigger.click();
  await menu.getByRole('menuitem').nth(2).click();
  await expect(trigger).toContainText('动效测试 3');
  await expect(menu).toBeHidden();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const rows = menu.getByRole('menuitem');
  await expect(rows.nth(2)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(rows.nth(0)).toBeFocused();
  await expect(rows.nth(2)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('End');
  await expect(rows.nth(2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rows.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('动效测试 2');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('悬停不开抢焦点，跨越间隙保持打开；关闭后可再次点击', async ({ page }) => {
  const { trigger, menu } = await boot(page);
  await page.evaluate(async () => {
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.getState().setNotebookDropdownHoverExpand(true);
    const input = document.createElement('input');
    input.id = 'notebook-focus-probe';
    document.body.append(input);
    input.focus();
  });
  await trigger.hover();
  await expect(menu).toHaveAttribute('data-state', 'open');
  await expect(page.locator('#notebook-focus-probe')).toBeFocused();
  await menu.getByRole('menuitem').first().hover();
  await expect(menu).toHaveAttribute('data-state', 'open');
  await page.mouse.move(700, 100);
  await expect(menu).toBeHidden();
  await expect(page.locator('#notebook-focus-probe')).toBeFocused();
  await trigger.hover();
  await trigger.click();
  await expect(menu).toHaveAttribute('data-state', 'open');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await trigger.click();
  await expect(menu).toHaveAttribute('data-state', 'open');
});

test('关闭退出交互，快速重开和减少动态效果均不残留隐藏焦点', async ({ page }) => {
  const { trigger, menu } = await boot(page);
  await trigger.click();
  await trigger.click();
  await expect(menu).toBeHidden();
  await trigger.click();
  await expect(menu).toHaveAttribute('data-state', 'open');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await expect(menu).toHaveCSS('transform', 'none');
  await page.mouse.click(700, 100);
  await expect(menu).toBeHidden();
});
