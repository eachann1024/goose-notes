在 PageHeader 中添加保存状态指示器，当内容保存完成后显示 done 图标。

**实现方案：**

1. **在** **`usePages.ts`** **中添加保存状态管理：**

   * 添加 `lastSavedAt` 状态记录最后保存时间

   * 在 `updatePage` 和 `saveLocalPageContent` 完成时更新该状态

2. **修改** **`PageHeader.tsx`：**

   * 监听保存状态变化

   * 保存完成后显示 `LucideIcons.Check` (✓) 图标

   * 图标显示几秒后自动消失

3. **UI 细节：**

   * 图标放在标题旁边

   * 使用绿色表示保存成功

   * 带淡入淡出动画效果

**涉及文件：**

* `/Users/eachann/Work/goose-note/src/stores/usePages.ts`

* `/Users/eachann/Work/goose-note/src/pages/workspace/components/page/PageHeader.tsx`

