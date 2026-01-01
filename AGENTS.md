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
6. **尽量不要造轮子**
7. **实现后请自行 pnpm build + 使用浏览器验证是否正常工作**
- 注意自动导入的规则, 减少自动导入的代码 必要时可追加新的规则到 vite.config.ts

---

## ⚠️ 数据持久化铁律（CRITICAL - 违反必究）

### 必须使用 uToolsStorage
**所有 Zustand store 必须显式使用 uToolsStorage**

```typescript
import { persist, createJSONStorage } from 'zustand/middleware'
import { uToolsStorage } from '@/lib/storage'

export const useXxx = create<XxxState>()(
  persist(
    (set, get) => ({ ... }),
    {
      name: 'goose-note-xxx',
      storage: createJSONStorage(() => uToolsStorage), // ← 必须写这一行！
    }
  )
)
```

**原因**：uTools 插件窗口关闭后会清空 `localStorage`，导致数据永久丢失。

### 禁止使用可能丢数据的延迟写入
- 节流/防抖存储必须在 `window.beforeunload` 或 `utools.onPluginOut` 时强制 flush
- 或直接使用同步写入，宁可性能差也不能丢数据

### 新增 store 前必检查
- [ ] 是否使用了 `storage: createJSONStorage(() => uToolsStorage)`？
- [ ] 是否有 flush 机制（如果使用了节流/防抖）？
- [ ] 关闭窗口后数据是否能恢复？
- [ ] 测试：打开插件 → 创建/编辑数据 → 关闭 → 重新打开 → 数据是否存在？

---

## 使用提示词库

维护文件：`src/lib/tips.ts`

添加新功能时，请同步更新提示词库，帮助用户发现新功能。提示词要求：
- 简洁明了，一句话说清
- 包含快捷键时标注 ⌘/Ctrl
- 新功能优先添加对应提示