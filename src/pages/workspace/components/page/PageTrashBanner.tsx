interface PageTrashBannerProps {
  onRestore: () => void;
  onDelete: () => void;
}

export function PageTrashBanner({ onRestore, onDelete }: PageTrashBannerProps) {
  return (
    <div className="bg-amber-500/90 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-4 shrink-0">
      <span className="flex items-center gap-2">
        <LucideIcons.Trash2 className="h-4 w-4" />
        此页面在垃圾箱中
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onRestore}
          className="px-3 py-1 bg-amber-950/20 hover:bg-amber-950/30 rounded text-xs transition-colors"
        >
          恢复页面
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs transition-colors"
        >
          永久删除
        </button>
      </div>
    </div>
  );
}
