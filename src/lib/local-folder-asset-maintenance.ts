import type {
  UnreferencedLocalAsset,
  RestoreMissingLocalAssetsResult,
  ScanUnreferencedLocalAssetsOptions,
} from "./local-folder-assets/types";
export type {
  UnreferencedLocalAsset,
  RestoreMissingLocalAssetsResult,
  AssetMaintenanceFs,
} from "./local-folder-assets/types";
import {
  collectNotebookFiles,
  collectReferenceIndex,
  relativePath,
  getFileSize,
  pathExists,
} from "./local-folder-assets/filesystem";
import {
  normalizePath,
  basename,
  isAbsolutePath,
  pathKey,
  isAssetPath,
  resolveLocalAssetPath,
  cleanAssetDestination,
} from "./local-folder-assets/references";
export {
  cleanAssetDestination,
  extractAssetReferencesFromMarkdown,
  getLocalAssetKind,
} from "./local-folder-assets/references";

export async function scanUnreferencedLocalAssets({
  basePath,
  pages,
  gooseFs,
}: ScanUnreferencedLocalAssetsOptions): Promise<UnreferencedLocalAsset[]> {
  const normalizedBasePath = normalizePath(basePath);
  if (!isAbsolutePath(basePath)) throw new Error("请选择本地文件夹笔记本");
  const files = await collectNotebookFiles(gooseFs, normalizedBasePath);
  const index = await collectReferenceIndex(
    { basePath, pages, gooseFs },
    files.markdown,
  );
  return files.assets
    .map((entry) => ({ ...entry, path: normalizePath(entry.path) }))
    .filter((entry) => {
      if (index.pathKeys.has(pathKey(entry.path))) return false;
      if (index.names.has(entry.name.toLowerCase())) return false;
      return true;
    })
    .map((entry) => ({
      path: entry.path,
      relativePath: relativePath(normalizedBasePath, entry.path),
      name: entry.name,
      size: getFileSize(gooseFs, entry),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function restoreMissingReferencedLocalAssets({
  basePath,
  pages,
  gooseFs,
}: ScanUnreferencedLocalAssetsOptions): Promise<RestoreMissingLocalAssetsResult> {
  const restored: string[] = [];
  const missing: string[] = [];
  if (!gooseFs.restoreFromTrash) {
    return { restored, missing };
  }

  const index = await collectReferenceIndex({ basePath, pages, gooseFs });
  const byName = new Map<string, string[]>();
  for (const assetPath of index.paths) {
    if (!isAssetPath(assetPath)) continue;
    const name = basename(assetPath).toLowerCase();
    const current = byName.get(name) ?? [];
    current.push(assetPath);
    byName.set(name, current);
  }
  for (const [name, dests] of byName) {
    const uniqueDests = [...new Set(dests.map(normalizePath))];
    const missingDests: string[] = [];
    let hasExisting = false;
    for (const dest of uniqueDests) {
      if (await pathExists(gooseFs, dest)) {
        hasExisting = true;
        break;
      }
      missingDests.push(dest);
    }
    if (hasExisting || missingDests.length === 0) continue;

    missingDests.sort((a, b) => {
      const parentRank = Number(isAssetPath(b)) - Number(isAssetPath(a));
      if (parentRank !== 0) return parentRank;
      return b.length - a.length;
    });

    let recovered = false;
    for (const dest of missingDests) {
      try {
        const ok = await gooseFs.restoreFromTrash(dest);
        if (ok) {
          restored.push(dest);
          recovered = true;
          break;
        }
      } catch {
        // try next candidate path
      }
    }
    if (!recovered) {
      missing.push(missingDests[0] ?? name);
    }
  }

  return { restored, missing };
}

export const localAssetPaths = {
  normalizePath,
  resolveLocalAssetPath,
  cleanAssetDestination,
};
