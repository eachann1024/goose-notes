/** 工作区外部文件拖入时，侧栏悬停行的目标文件夹（pageId）。null 表示未悬停侧栏行。 */
let hoveredDropTargetPageId: string | null = null;

export function setLocalFolderFileDropTarget(pageId: string | null): void {
  hoveredDropTargetPageId = pageId;
}

export function getLocalFolderFileDropTarget(): string | null {
  return hoveredDropTargetPageId;
}

export function clearLocalFolderFileDropTarget(): void {
  hoveredDropTargetPageId = null;
}
