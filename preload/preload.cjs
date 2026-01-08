// preload 运行在 CJS，避免与主项目 ESM 冲突
if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;

  // 处理 uTools 全局搜索（sublist）点击
  // 注意：sublist API 可能不是所有 uTools 版本都支持
  if (typeof utools.onSublistEnter === "function") {
    utools.onSublistEnter((item) => {
      const pageId = item.url.replace("goose-note://page/", "");

      // 通知应用切换页面
      window.dispatchEvent(
        new CustomEvent("goose-note:navigate", {
          detail: { pageId },
        }),
      );
    });
  }

  if (typeof utools.setSubInput === "function") {
    const UTOOLS_INPUT_EVENT = "goose-note:utools-search";
    const APP_SYNC_EVENT = "goose-note:utools-search-sync";
    let suppressNextChange = false;
    let lastAppValue = "";

    utools.onPluginEnter(() => {
      utools.setSubInput(
        ({ text }) => {
          if (suppressNextChange && text === lastAppValue) {
            suppressNextChange = false;
            return;
          }

          window.dispatchEvent(
            new CustomEvent(UTOOLS_INPUT_EVENT, {
              detail: { text },
            }),
          );
        },
        "搜索笔记",
        true,
      );
    });

    if (typeof utools.onPluginOut === "function") {
      utools.onPluginOut(() => {
        if (typeof utools.removeSubInput === "function") {
          utools.removeSubInput();
        }
      });
    }

    window.addEventListener(APP_SYNC_EVENT, (event) => {
      const detail = event.detail || {};
      const text = typeof detail.text === "string" ? detail.text : "";
      if (text === lastAppValue) return;
      lastAppValue = text;
      if (typeof utools.setSubInputValue === "function") {
        suppressNextChange = true;
        utools.setSubInputValue(text);
      }
    });
  }
}
