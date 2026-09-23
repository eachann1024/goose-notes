import { test, expect } from 'playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('Electron search uses real local files without modifying them', async ({}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), 'goose-search-acceptance-'));
  const notes = join(root, 'notes');
  const otherNotes = join(root, 'other');
  await mkdir(notes);
  await mkdir(otherNotes);
  const content = '# 华为验收\n\n## 搜索预览\n\n- 列表项\n\n```js\nconst answer = 42;\n```\n\n' + 'https://example.com/path/'.repeat(120);
  await writeFile(join(notes, '华为验收.md'), content);
  await writeFile(join(notes, '普通笔记.md'), '# 普通笔记\n\n这是普通内容。');
  await writeFile(join(otherNotes, '华为跨本.md'), '# 华为跨本\n\n另一笔记本的正文。');
  const app = await electron.launch({
    args: [resolve('dist-electron/main/index.js'), `--user-data-dir=${join(root, 'profile')}`],
    env: { ...process.env, ELECTRON_RENDERER_URL: process.env.E2E_BASE_URL ?? 'http://localhost:6001' },
  });
  try {
    const page = await app.firstWindow();
    // 隔离真实桌面鼠标事件，仍通过 Electron 的真实渲染器与文件 IPC 验收。
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.setBackgroundThrottling(false);
        window.setIgnoreMouseEvents(true);
      }
    });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForFunction(() => Boolean(window.__GOOSE_TEST__));
    await page.evaluate(async () => {
      const { useSettings } = await import('/src/stores/useSettings.ts');
      useSettings.setState({ setupGuideSeen: true, setupGuideOpen: false });
    });
    const ids: string[] = [];
    for (const directory of [notes, otherNotes]) {
      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
      }, directory);
      ids.push(await page.evaluate(async () => {
        const path = await window.gooseDesktop.selectDirectory();
        if (!path) throw new Error('Temporary notebook was not selected');
        const { useNotebooks } = await import('/src/stores/useNotebooks.ts');
        const { usePages } = await import('/src/stores/usePages.ts');
        const id = useNotebooks.getState().createLocalFolderNotebook('验收笔记本', path);
        await usePages.getState().loadLocalFolderPages(id, path);
        useNotebooks.setState({ activeNotebookId: id });
        return id;
      }));
    }
    await page.evaluate(async id => {
      const { useNotebooks } = await import('/src/stores/useNotebooks.ts');
      useNotebooks.setState({ activeNotebookId: id });
      window.dispatchEvent(new CustomEvent('goose-note:open-search'));
    }, ids[0]);
    const input = page.locator('[cmdk-input]');
    const scope = page.locator('.goose-search-scope');
    const items = page.locator('[cmdk-item]');
    const preview = page.locator('.goose-search-preview');
    await expect(input).toBeVisible();
    // 首次显示完成后取消原生焦点，防止用户在其他应用打字进入验收窗口。
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setFocusable(false);
        window.blur();
      }
    });
    await scope.selectOption('current');
    await input.fill('华为');
    await expect(items).toHaveCount(1);
    await expect(preview.locator('pre')).toContainText('const answer = 42');
    await expect(preview.locator('[contenteditable=true]')).toHaveCount(0);
    await input.press('Tab');
    await expect(scope).toHaveValue('all');
    await expect(items).toHaveCount(2);
    await items.filter({ hasText: '华为跨本' }).hover();
    await expect(preview).toContainText('另一笔记本的正文');
    await scope.selectOption(`notebook:${ids[0]}`);
    await expect(items).toHaveCount(1);
    const separator = page.locator('.goose-search-separator');
    const box = (await separator.boundingBox())!;
    const before = (await page.locator('.goose-search-results-panel').boundingBox())!;
    await page.mouse.move(box.x + 3, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 95, box.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await page.locator('.goose-search-results-panel').boundingBox())!.width).toBeGreaterThan(before.width + 40);
    await input.fill('阿是');
    await expect(items).toHaveCount(0);
    await input.fill('华为');
    await expect(items).toHaveCount(1);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(async theme => {
        const { useSettings } = await import('/src/stores/useSettings.ts');
        useSettings.getState().setTheme(theme);
      }, theme);
      await expect(items.first()).toHaveCSS('background-color', theme === 'dark' ? 'rgb(49, 68, 91)' : 'rgb(225, 235, 248)');
      await expect(page.locator('.goose-search-panel')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(37, 40, 45)' : 'rgb(255, 255, 255)');
      const bounds = await page.locator('.goose-search-panel').evaluate(el => {
        const root = el.getBoundingClientRect();
        const right = el.querySelector('.goose-search-preview')!.getBoundingClientRect();
        return { outerRight: root.right, right: right.right, width: right.width };
      });
      expect(bounds.right).toBeLessThanOrEqual(bounds.outerRight + 1);
      expect(bounds.width).toBeGreaterThan(300);
      await page.screenshot({ path: testInfo.outputPath(`electron-search-${theme}.png`) });
    }
    await input.press('Escape');
    await expect(page.locator('.goose-search-panel')).toHaveCount(0);
    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await input.fill('华为');
    await input.press('Enter');
    await expect(page.locator('.goose-search-panel')).toHaveCount(0);
    await expect(page.locator('.bn-editor').first()).toContainText('搜索预览');
    expect(errors).toEqual([]);
    expect(await readFile(join(notes, '华为验收.md'), 'utf8')).toBe(content);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
