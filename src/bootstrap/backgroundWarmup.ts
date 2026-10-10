import { usePages } from "@/stores/usePages";

export function scheduleBackgroundWarmup(rootElement: HTMLElement) {
  // 主窗启动后后台静默预热所有 local-folder 记事本页面，使「所有记事本」全局搜索覆盖全量。
  // 不 await：不阻塞首屏；小窗（quicknote）不预热。idle 时机执行，避开首屏渲染高峰。
  if (rootElement.dataset.entry !== "quicknote") {
    const preloadAll = async () => {
      try {
        await usePages.getState().loadAllLocalFolderPages();
      } catch (err) {
        console.error("预加载本地文件夹页面失败", err);
      }
      try {
        const { triggerAutoWebdavBackup } = await import("@/lib/webdavSync");
        void triggerAutoWebdavBackup();
      } catch (err) {
        console.error("加载 webdavSync 模块失败", err);
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(preloadAll, { timeout: 4000 });
    } else {
      setTimeout(preloadAll, 1500);
    }
  }
}
