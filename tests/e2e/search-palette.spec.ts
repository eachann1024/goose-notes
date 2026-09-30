import { expect, test, type Page } from 'playwright/test';

async function openSearch(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('goose-note:open-search')));
  await expect(page.locator('.goose-search-panel')).toBeVisible();
}

async function seed(page: Page) {
  await page.goto('/?e2eLocalMock');
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  return page.evaluate(async () => {
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.setState({ setupGuideSeen: true, setupGuideOpen: false });
    const h = window.__gooseTest!;
    h.setMockFile('/mock-notes/鸿蒙验收.md', '# 鸿蒙验收\n\n华为搜索验收正文。\n\n## 二级标题\n\n- 列表条目\n\n```js\nconst answer = 42;\n```\n\n' + 'https://example.com/very-long-path/'.repeat(35));
    h.setMockFile('/mock-notes/华为另一篇.md', '# 华为另一篇\n\n华为独立内容第二篇。');
    h.setMockFile('/mock-notes/只含是.md', '# 只含是\n\n这是普通内容，没有另一个查询字。');
    for (let i = 0; i < 45; i++) h.setMockFile(`/mock-notes/分页${i}.md`, `# 分页${i}\n\n分页验收正文。`);
    const { notebookId } = await h.setupMockNotebook();
    const other = h.stores.useNotebooks.getState().createLocalFolderNotebook('另一笔记本', '/other-notes');
    h.setMockFile('/other-notes/外部笔记.md', '# 外部笔记\n\n华为跨本独有内容。');
    await h.stores.usePages.getState().loadLocalFolderPages(other, '/other-notes');
    h.stores.useNotebooks.setState({ activeNotebookId: notebookId });
    h.resetWriteLog();
    return { notebookId, other };
  });
}

async function assertContained(page: Page) {
  const boxes = await page.locator('.goose-search-panel').evaluate(root => {
    const outer = root.getBoundingClientRect();
    return ['[cmdk-root]', '.goose-search-body', '.goose-search-results-panel', '.goose-search-preview-panel', '.goose-search-scope'].map(selector => {
      const el = root.querySelector(selector)!;
      const b = el.getBoundingClientRect();
      return { selector, left: b.left, right: b.right, outerLeft: outer.left, outerRight: outer.right, width: b.width };
    });
  });
  for (const b of boxes) {
    expect(b.left, b.selector).toBeGreaterThanOrEqual(b.outerLeft - 1);
    expect(b.right, b.selector).toBeLessThanOrEqual(b.outerRight + 1);
  }
}

test('search layout, scope, preview, keyboard, resize, pagination and opening', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const ids = await seed(page);
  await openSearch(page);
  const input = page.locator('[cmdk-input]');
  const scope = page.locator('.goose-search-scope');
  const items = page.locator('[cmdk-item]');
  const preview = page.locator('.goose-search-preview');
  await scope.selectOption('current');
  await input.fill('华为');
  await expect(items).toHaveCount(2);
  await assertContained(page);
  await expect(preview.locator('[contenteditable=true]')).toHaveCount(0);
  await input.press('ArrowDown');
  await expect(preview).toContainText('鸿蒙验收');
  await expect(preview.locator('h2')).toContainText('二级标题');
  await expect(preview.locator('pre')).toContainText('const answer = 42');
  await input.press('ArrowUp');
  await expect(preview).toContainText('华为独立内容第二篇');
  await expect(preview).not.toContainText('const answer = 42');
  await input.press('Tab');
  await expect(scope).toHaveValue('all');
  await expect(items).toHaveCount(3);
  await scope.selectOption(`notebook:${ids.other}`);
  await expect(items).toHaveCount(1);
  await expect(items).toContainText('外部笔记');
  expect(await page.evaluate(() => window.__gooseTest!.stores.useNotebooks.getState().activeNotebookId)).toBe(ids.notebookId);
  await input.press('Tab');
  await expect(scope).toHaveValue('current');
  await expect(items).toHaveCount(2);
  const separator = page.getByRole('separator', { name: '调整搜索结果与预览宽度' });
  const before = await page.locator('.goose-search-results-panel').boundingBox();
  const sash = (await separator.boundingBox())!;
  await page.mouse.move(sash.x + sash.width / 2, sash.y + 100);
  await page.mouse.down();
  await page.mouse.move(sash.x + 120, sash.y + 100, { steps: 8 });
  await page.mouse.up();
  expect((await page.locator('.goose-search-results-panel').boundingBox())!.width).toBeGreaterThan(before!.width + 50);
  await assertContained(page);
  await separator.focus();
  await separator.press('ArrowLeft');
  await assertContained(page);
  await input.fill('ZZZ无匹配987654');
  await expect(items).toHaveCount(0);
  await expect(page.getByText('未找到匹配的页面', { exact: true })).toBeVisible();
  await expect(preview).not.toContainText('华为独立内容第二篇');
  await input.fill('阿是');
  await expect(items).toHaveCount(0);
  await input.fill('hongmeng');
  await expect(items).toHaveCount(1);
  await expect(items).toContainText('鸿蒙验收');
  await input.fill('分页');
  await expect.poll(() => items.count()).toBeGreaterThanOrEqual(30);
  await page.locator('[cmdk-list]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(items).toHaveCount(45);
  await input.fill('华为');
  await expect(items).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('search-light.png') });
  await page.evaluate(async () => {
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.getState().setTheme('dark');
  });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await assertContained(page);
  await expect(page.locator('.goose-search-title').first()).toHaveCSS('color', 'rgb(240, 242, 245)');
  await page.screenshot({ path: testInfo.outputPath('search-dark.png') });
  await page.setViewportSize({ width: 825, height: 948 });
  await expect(preview).not.toBeVisible();
  const narrowList = (await page.locator('[cmdk-list]').boundingBox())!;
  const narrowDialog = (await page.locator('.goose-search-panel').boundingBox())!;
  expect(narrowList.width).toBeGreaterThan(narrowDialog.width - 10);
  await expect(scope).toBeVisible();
  await expect(input).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('search-narrow.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(preview).toBeVisible();
  await assertContained(page);
  await input.press('Escape');
  await expect(page.locator('.goose-search-panel')).not.toBeVisible();
  await openSearch(page);
  await input.fill('鸿蒙验收');
  await expect(items).toHaveCount(1);
  await input.press('Enter');
  await expect(page.locator('.goose-search-panel')).not.toBeVisible();
  await expect(page.locator('.bn-editor').first()).toContainText('华为搜索验收正文');
  await openSearch(page);
  await input.fill('华为另一篇');
  await expect(items).toHaveCount(1);
  await items.click();
  await expect(page.locator('.goose-search-panel')).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__gooseTest!.getWriteLog())).toEqual([]);
});


test('long notebook and note titles stay within the dialog at every size', async ({ page }, testInfo) => {
  await seed(page);
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const nb = h.stores.useNotebooks.getState().activeNotebookId!;
    h.stores.useNotebooks.setState(s => ({ notebooks: { ...s.notebooks, [nb]: { ...s.notebooks[nb], name: '非常长的记事本名称'.repeat(40) } } }));
    h.setMockFile('/mock-notes/long.md', '# ' + 'https://example.com/long-path'.repeat(30) + '\n\n华为长标题验收正文');
    await h.stores.usePages.getState().loadLocalFolderPages(nb, '/mock-notes');
  });
  await openSearch(page);
  await page.locator('[cmdk-input]').fill('华为');
  await expect(page.locator('[cmdk-item]')).toHaveCount(3);
  for (const width of [1440, 1100, 920]) {
    await page.setViewportSize({ width, height: 900 });
    await assertContained(page);
    const results = (await page.locator('.goose-search-results-panel').boundingBox())!;
    const body = (await page.locator('.goose-search-body').boundingBox())!;
    expect(results.width / body.width).toBeLessThan(0.66);
  }
  await page.screenshot({ path: testInfo.outputPath('search-long-content.png') });
});

test('recent items, selection changes, IME, command results and read-only preview', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.getState().setShowRecentInSearch(true);
  });
  await openSearch(page);
  const input = page.locator('[cmdk-input]');
  await expect(page.getByRole('button', { name: '隐藏最近访问' })).toBeVisible();
  const recentRemove = page.getByRole('button', { name: /^从最近访问中移除/ });
  await recentRemove.first().click({ force: true });
  await expect(recentRemove).toHaveCount(5);
  await page.getByRole('button', { name: '隐藏最近访问' }).click();
  await expect(page.getByRole('button', { name: '隐藏最近访问' })).toHaveCount(0);
  await input.fill('华为');
  await page.locator('.goose-search-scope').selectOption('current');
  await input.press('ArrowDown');
  await expect(page.locator('.goose-search-preview')).toContainText('鸿蒙验收');
  await input.fill('华为另一篇');
  await expect(page.locator('[cmdk-item]')).toHaveCount(1);
  await expect(page.locator('[cmdk-item][aria-selected=true]')).toHaveCount(1);
  await expect(page.locator('.goose-search-preview')).toContainText('华为独立内容第二篇');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 });
  await expect(page.locator('.goose-search-panel')).toBeVisible();
  const editable = page.locator('.goose-search-preview [contenteditable]');
  await expect(editable).toHaveAttribute('contenteditable', 'false');
  const original = await editable.textContent();
  await editable.click();
  await page.keyboard.type('DO NOT WRITE');
  await expect(editable).toHaveText(original!);
  expect(await page.evaluate(() => window.__gooseTest!.getWriteLog())).toEqual([]);
  await input.fill('分屏');
  await expect(page.locator('[cmdk-group-heading]', { hasText: '分屏' })).toBeVisible();
  await expect(page.locator('.goose-search-preview')).toContainText('选择命令并按回车执行');
  await input.press('Escape');
  await expect(page.locator('.goose-search-panel')).toHaveCount(0);
});
