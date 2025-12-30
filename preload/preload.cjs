// preload 运行在 CJS，避免与主项目 ESM 冲突
if (typeof window !== 'undefined' && typeof utools !== 'undefined') {
  window.utools = utools

  // 处理 uTools 全局搜索（sublist）点击
  // 注意：sublist API 可能不是所有 uTools 版本都支持
  if (typeof utools.onSublistEnter === 'function') {
    utools.onSublistEnter((item) => {
      const pageId = item.url.replace('goose-notion://page/', '')

      // 通知应用切换页面
      window.dispatchEvent(new CustomEvent('goose-notion:navigate', {
        detail: { pageId }
      }))
    })
  }
}
