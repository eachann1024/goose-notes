import { applyFontVariables } from "@/lib/fontLoader";
import { applyAppearanceScaleVariables } from "@/lib/appearance";
import { migrateLegacyStorage } from "@/lib/storage/migrateLegacyStorage";
import { HostAdapter } from "@/lib/host/adapter";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { setupSaveGuards } from "./saveGuards";

export async function initializeApplicationState(
  lean: boolean,
  beforeInit?: () => Promise<void> | void,
) {
  await beforeInit?.();
  await HostAdapter.ensureGooseFs();
  if (!lean) {
    await migrateLegacyStorage();
  }
  await Promise.all([
    useSettings.persist.rehydrate(),
    useNotebooks.persist.rehydrate(),
  ]);
  if (!lean) {
    // NotebookAiChats 持久化 store（skipHydration=true，需手动水合）。主应用 AI 聊天记录，小窗不需要。
    const { useNotebookAiChats } = await import("@/stores/useNotebookAiChats");
    useNotebookAiChats.persist.rehydrate();
    // 加载+修复全部笔记（随笔记数线性变慢）；小窗草稿是独立存储，不读 pages。
    await usePages.getState().hydrateFromStorage();
    // Electron 仅本地文件夹模式不会恢复旧内置记事本，因此这些页面不会进入
    // 侧栏或成为活动页；但必须保留在 state 中，供备份链路和「设置 → 本地文件夹」
    // 的显式 Markdown 导出读取。不得在启动时过滤或清除这批升级数据。
    if (__HOST_TARGET__ === "electron") {
      usePages.setState({ activePageId: null, onboardingCompleted: true });
    }
  }
  if (!lean) {
    const nextNotebooksStore = useNotebooks.getState();
    if (
      !nextNotebooksStore.notebooks[nextNotebooksStore.activeNotebookId || ""]
    ) {
      // Electron：无仓库时保持 null（空态），绝不回落 DEFAULT_NOTEBOOK
      const firstNotebookId =
        Object.keys(nextNotebooksStore.notebooks)[0] ?? null;
      useNotebooks.setState({ activeNotebookId: firstNotebookId });
    }
  }
  if (!lean) {
    const { installAssetMaintenanceSnapshotResponder } =
      await import("@/lib/asset-maintenance-snapshot");
    installAssetMaintenanceSnapshotResponder();
    const { installGitSyncResponder } =
      await import("@/lib/git-sync-responder");
    installGitSyncResponder();
  }
  setupSaveGuards();
  const settings = useSettings.getState();
  applyFontVariables(settings.customFonts, settings);
  // 首帧前同步落定界面字号与编辑器缩放：窗口一出现就处于上次状态，
  // 不再先按 100% 布局、等 App effect 再跳回（用户看到的“突兀缩小”）。
  applyAppearanceScaleVariables({
    uiFontSize: settings.uiFontSize,
    editorFontSize: settings.editorFontSize,
    editorLineHeight: settings.editorLineHeight,
  });
}
