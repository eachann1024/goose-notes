import type { Page } from "@/types";

export async function loadExportHistory(exportPagesList: Page[]) {
  // 读取并打包历史记录数据
  const { resolveHistoryBackend } = await import("@/lib/history/backend");
  const exportHistory: Record<string, { index: any; versions: any[] }> = {};

  for (const page of exportPagesList) {
    try {
      const backend = resolveHistoryBackend(page.id);
      const index = await backend.loadIndex(page.id);
      if (index && index.versions && index.versions.length > 0) {
        const versions: any[] = [];
        for (const v of index.versions) {
          const version = await backend.loadVersion(page.id, v.versionId);
          if (version) {
            versions.push(version);
          }
        }
        exportHistory[page.id] = {
          index,
          versions,
        };
      }
    } catch (err) {
      console.error(`Failed to export history for page ${page.id}:`, err);
    }
  }

  return exportHistory;
}
