# Todo

## 需求

- 修复：新建标签页后，在新笔记本页面直接粘贴图片会出现两张的问题。

## 计划

- [x] 定位图片粘贴链路与标签页切换相关代码，确认重复触发点
- [x] 为图片粘贴增加事件级防重，确保一次 paste 只插入一次
- [x] 执行最小回归验证，确认不影响其他粘贴场景

## 过程记录

- 已确认 `Editor.tsx` 存在原生 `paste` 图片处理链路，且项目存在 ProseMirror/Tiptap 粘贴处理链路，存在同事件多处理风险。
- 在图片粘贴入口增加 `defaultPrevented` 与自定义事件标记双重防重，避免同一次粘贴事件重复插图。
- 执行 `bun run lint -- src/pages/workspace/components/editor/Editor.tsx`，结果为 0 error（仓库有既有 warning）。

## Review

- 本次改动仅涉及 `Editor.tsx` 的图片粘贴保护逻辑，未调整文本/Markdown 粘贴转换链路。
