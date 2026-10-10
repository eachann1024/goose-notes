export async function restoreImportedHistory(history: Record<string, any>, importedPageIdMap: Map<string, string>) {
    // 还原并合并历史记录数据到本地数据库
    if (history) {
      const { resolveHistoryBackend } = await import("@/lib/history/backend");
      const { selectEvictedVersionIds } = await import(
        "@/lib/history/retention"
      );

      for (const [sourcePageId, historyItem] of Object.entries(
        history,
      ) as [string, any][]) {
        try {
          const pageId = importedPageIdMap.get(sourcePageId) ?? sourcePageId;
          const backend = resolveHistoryBackend(pageId);
          const localIndex = await backend.loadIndex(pageId);
          const importedIndex = historyItem.index;
          const importedVersions = historyItem.versions || [];

          if (!importedIndex) continue;

          // 1. 合并 versions 列表并去重
          const versionMap = new Map<string, any>();

          if (localIndex && Array.isArray(localIndex.versions)) {
            for (const v of localIndex.versions) {
              versionMap.set(v.versionId, v);
            }
          }
          if (Array.isArray(importedIndex.versions)) {
            for (const v of importedIndex.versions) {
              versionMap.set(v.versionId, v);
            }
          }

          // 按时间戳从小到大排序
          let mergedVersions = Array.from(versionMap.values()).sort(
            (a, b) => a.createdAt - b.createdAt,
          );

          // 2. 超出数量限制裁剪（淘汰最旧的非 Milestone）
          const evictedVersionIds = selectEvictedVersionIds(mergedVersions);
          if (evictedVersionIds.length > 0) {
            const evictedSet = new Set(evictedVersionIds);
            mergedVersions = mergedVersions.filter(
              (v) => !evictedSet.has(v.versionId),
            );
          }

          // 3. 计算最新的字符数
          const lastVersionCharCount =
            mergedVersions.length > 0
              ? mergedVersions[mergedVersions.length - 1].charCount
              : 0;

          // 4. 保存合并后的索引
          await backend.saveIndex({
            pageId,
            versions: mergedVersions,
            lastVersionCharCount,
          });

          // 5. 写入导入的历史版本
          if (Array.isArray(importedVersions)) {
            const activeVersionIds = new Set(
              mergedVersions.map((v) => v.versionId),
            );
            for (const version of importedVersions) {
              if (activeVersionIds.has(version.versionId)) {
                await backend.saveVersion({ ...version, pageId });
              }
            }
          }

          // 6. 清理淘汰裁剪掉的本地历史版本
          for (const evictedId of evictedVersionIds) {
            await backend.removeVersion(pageId, evictedId);
          }
        } catch (err) {
          console.error(
            `Failed to restore and merge history for page ${sourcePageId}:`,
            err,
          );
        }
      }
    }

}
