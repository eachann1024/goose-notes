# 鹅的notion - Agent Rules

## 技术栈

**必须**: React 18 + Vite, @tiptap/react, shadcn/ui, TailwindCSS, zustand, unplugin-auto-import

**禁止**: Redux/MobX, styled-components, moment.js

---

## 开发约定

1. 组件 ≤300 行（Sidebar/Editor 可放宽）
2. 全局状态用 zustand，局部用 useState
3. 注释只解释 Why，不解释 What
4. shadcn/hooks 由 autoimport 处理
5. 每个模块独立运行不要有耦合关系
6. auto-import 由 unplugin-auto-import 自动生成，需对照 `vite.config.ts` 配置

---

## ⚠️ 数据持久化（CRITICAL）

**Zustand store 必须用 uToolsStorage**（uTools 关闭后 localStorage 会清空）

```typescript
import { persist, createJSONStorage } from 'zustand/middleware'
import { uToolsStorage } from '@/lib/storage'

export const useXxx = create<XxxState>()(
  persist(
    (set, get) => ({ ... }),
    {
      name: 'goose-note-xxx',
      storage: createJSONStorage(() => uToolsStorage), // ← 必须
    }
  )
)
```

**例外**: 临时 UI 状态（如 useContextMenu）无需持久化

---

## 功能开发同步

- 新功能更新 `src/lib/tips.ts` 帮助用户发现
- Page 类型定义见 `src/types/index.ts`
- 图片处理见 `src/lib/imageProcessor.ts`（>500KB 压缩 80%）
- 自动导入范围以 `vite.config.ts` 为准
