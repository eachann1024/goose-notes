## 修改方案

### 1. SettingsGeneral.tsx
将第 94 行的条件 `(UToolsAdapter.isUTools || import.meta.env.DEV)` 改为 `UToolsAdapter.isUTools`，确保以下 uTools 独有功能只在 uTools 环境显示：
- 插件设置（使用 uTools 打开搜索结果）
- 窗口高度调节
- 快捷动作配置

### 2. EditorContextMenu.tsx
给"快捷动作"右键菜单项添加 uTools 环境判断，使用 `UToolsAdapter.isUTools` 条件包裹第 104-129 行的代码块。

这样 web 端将只保留通用功能（搜索引擎、剪切/拷贝/粘贴），所有 uTools 独有功能都会被正确隐藏。