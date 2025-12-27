# 鹅的notion - Project Agent Rules

## 项目概述
基于 tiptap 的 Notion 风格本地笔记应用，作为 uTools 插件运行。

---

## 🎨 Tiptap 设计风格总结

### 视觉特征
- **简洁留白**：大量空白间距，内容不拥挤
- **暗色模式优先**：深灰背景 (#1a1a1a)，柔和白字
- **圆角卡片**：8-12px border-radius
- **微妙阴影**：box-shadow 层次感
- **渐变点缀**：紫→蓝渐变用于高亮元素

### 排版规范
- **字体族**：Inter / SF Pro 为主
- **字号层级**：H1 2.5rem, H2 1.75rem, body 1rem
- **行高**：1.6-1.8 阅读舒适度

### 交互特征
- **悬停反馈**：轻微背景变化 + 颜色过渡
- **流畅动画**：200-300ms 过渡时间
- **斜杠命令**：`/` 触发块级菜单
- **浮动工具栏**：选中文字后出现格式化选项

### 代码命名约定
```
组件: PascalCase (PageHeader.tsx)
hooks: camelCase with use prefix (usePages.ts)
工具: camelCase (imageProcessor.ts)
CSS: kebab-case (editor-styles.css)
```

---

## 技术栈规范

### 必须使用
- React 18 + Vite
- @tiptap/react + StarterKit
- shadcn/ui 组件库
- TailwindCSS (latest, 不指定版本)
- zustand 状态管理
- unplugin-auto-import

### 禁止使用
- Redux / MobX (太重)
- styled-components (与 Tailwind 冲突)
- moment.js (使用 dayjs 或原生)

---

## 数据结构核心

### Page 对象
```typescript
interface Page {
  id: string
  workspaceId: string
  parentId?: string
  title: string
  content: TiptapDocument
  fontFamily: 'default' | 'serif' | 'mono'
  fontSize: 'default' | 'small'
  isLocked: boolean
  isFullWidth: boolean
  createdAt: number
  updatedAt: number
  trashedAt?: number
}
```

### 图片处理规则
- 超过 500KB 自动压缩至 80% 质量
- 添加 `_compressed: true` 标记
- 小于 100KB 内嵌 base64
- 大于 100KB 存 uTools 文件系统

---

## 三种字体族

```css
/* 默认：无衬线 */
--font-default: "Inter", "SF Pro", system-ui, sans-serif;

/* 衬线体 */
--font-serif: "Noto Serif SC", "Georgia", serif;

/* 等宽体 */
--font-mono: "JetBrains Mono", "Fira Code", monospace;
```

---

## 开发约定

1. **组件拆分**：单个组件不超过 200 行
2. **状态管理**：全局用 zustand，局部用 useState
3. **错误处理**：使用 try-catch 包裹异步操作
4. **注释规范**：只解释 Why，不解释 What
5. **导入规则**：shadcn 和 hooks 由 autoimport 处理
