// 打开笔记本菜单后，在浏览器开发者工具控制台运行；关闭后可再次运行。
(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const close = (a, b) => Math.abs(a - b) < 1;
  const trigger = document.querySelector('.sidebar-notebook-trigger');
  assert(trigger, '缺少笔记本入口');
  const shellElement = trigger.querySelector('.goose-notebook-shell');
  const shell = shellElement && getComputedStyle(shellElement);
  const menu = document.querySelector('.goose-notebook-menu-surface');
  if (trigger.dataset.state !== 'open') {
    assert(!menu || menu.inert, '关闭立即退出键盘交互');
    assert(!menu || getComputedStyle(menu).pointerEvents === 'none', '关闭立即退出鼠标交互');
    if (trigger.dataset.present === 'true') {
      assert(menu && !menu.hidden, '退出动画期间保留菜单');
      return 'PASS: 退出期间不可交互';
    }
    assert(!shell || shell.visibility === 'hidden', '退出结束后不应残留外壳');
    assert(!menu || menu.hidden, '退出结束后隐藏菜单');
    return 'PASS: 退出后外壳和菜单隐藏';
  }
  assert(shell, '缺少单一外壳');
  assert(Math.abs(new DOMMatrixReadOnly(shell.transform).m22 - 1) < 0.001, '展开完成后外壳必须 scaleY(1)，不能被几何更新重置');
  assert(menu && !menu.hidden && !menu.inert, '浮层必须可见且可交互');
  const t = trigger.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const left = Math.min(m.left, t.left - 7);
  const top = Math.min(m.top, t.top - 7);
  assert(close(t.left + parseFloat(shell.left), left), '外壳左边错位');
  assert(close(t.top + parseFloat(shell.top), top), '外壳顶部错位');
  assert(close(parseFloat(shell.width), Math.max(m.right, t.right + 7) - left), '外壳宽度未覆盖两部分');
  assert(close(parseFloat(shell.height), Math.max(m.bottom, t.bottom + 7) - top), '外壳高度未覆盖两部分');
  const popup = getComputedStyle(menu);
  assert(popup.backgroundColor === 'rgba(0, 0, 0, 0)', '浮层不应再单独画背景');
  assert(popup.borderTopColor === 'rgba(0, 0, 0, 0)', '浮层不应再单独画边框');
  assert(popup.boxShadow === 'none' && getComputedStyle(trigger).boxShadow === 'none', '不能用两套阴影拼接');
  assert(shell.clipPath === 'none', '不能裁切外壳投影制造接缝');
  assert(menu.querySelectorAll('.goose-notebook-shell').length === 0, '浮层不能复制外壳');
  assert(shell.boxShadow !== 'none' && shell.backgroundColor !== 'rgba(0, 0, 0, 0)', '共用外壳必须绘制背景与阴影');
  assert(shell.pointerEvents === 'none', '背景不应拦截笔记本操作');
  // 临时启用外壳命中测试：背景必须盖住真实树行，而不只检查背景颜色。
  const probe = document.createElement('style');
  probe.textContent = `
    .goose-notebook-shell { pointer-events: auto !important; }
    .goose-notebook-menu-surface, .goose-notebook-menu-surface * { pointer-events: none !important; }
  `;
  document.head.append(probe);
  try {
    for (let y = m.top + 12; y < m.bottom - 12; y += 8) {
      for (let x = m.left + 12; x < m.right - 12; x += 8) {
        assert(document.elementFromPoint(x, y) === shellElement, '侧栏内容遮挡菜单外壳');
      }
    }
  } finally {
    probe.remove();
  }
  for (const row of menu.querySelectorAll('.goose-notebook-row')) {
    const r = row.getBoundingClientRect();
    assert(close(r.left, t.left) && close(r.width, t.width), '菜单行与入口宽度未对齐');
  }
  return 'PASS: 单一外壳 / 连续边框 / 无重复阴影 / 行宽对齐 / 无树行遮挡';
})();
