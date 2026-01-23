# 鹅的notion - Agent Rules

## 技术栈

**必须**: React 18 + Vite, @tiptap/react, shadcn/ui, TailwindCSS, zustand, unplugin-auto-import

---

## 开发约定

1. 组件 ≤300 行（Sidebar/Editor 可放宽）
2. 全局状态用 zustand，局部用 useState
3. 注释只解释 Why，不解释 What
4. shadcn/hooks 由 autoimport 处理
5. 每个模块独立运行不要有耦合关系
6. 永远不要手动写 import 语句！
7. 项目已开启全面 auto-import（components、composables、utils、stores 等全部自动可用）
8. 除非是 node_modules 里的第三方包，否则禁止出现任何 import XXX from '...' 语句，除了图标需要 import 之外
9. 如果你不确定组件路径 → 直接写组件名，依靠 LSP 和 auto-import
10. 所有交互控件严禁直接手动编写，而是使用 “shadcn vue” 组件，没有应该到官网查找，例如：`npx shadcn-vue@latest add slider`，严禁 AI 冒充编写 shadcn vue 组件
11. dev 脚本运行的: port 6001

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
