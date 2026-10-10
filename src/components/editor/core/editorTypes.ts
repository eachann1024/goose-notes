import type { useCreateBlockNote } from "@blocknote/react";
export interface EditorRef {
  editor: ReturnType<typeof useCreateBlockNote> | null;
}

export interface EditorProps {
  editable?: boolean;
  /**
   * 分屏时只有聚焦叶为 true。AI / 查找 / 大纲 / 全局 focus 事件走聚焦实例。
   * 未传时视为 true（速记小窗、单编辑器宿主）。
   */
  isActiveEditor?: boolean;
  /** 是否启用当前运行环境提供的拼写检查。 */
  spellCheck?: boolean;
  /**
   * 需从斜杠菜单隐藏的项标题列表（按 title 精确匹配）。
   * 紧凑宿主可用它隐藏表格、图片、AI 等重型项；不传则保持全量。
   */
  hiddenSlashItemTitles?: string[];
  /**
   * 是否显示块侧边菜单（+ / ⋮⋮）。默认 true（主编辑器）。
   * 窄布局可传 false，避免浮动菜单与块 hover 判定互相干扰。
   */
  showSideMenu?: boolean;
}
