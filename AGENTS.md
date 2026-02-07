## 技术栈

**必须**: React 18 + Vite, @tiptap/react, shadcn/ui, TailwindCSS, zustand, unplugin-auto-import

---

## 开发约定

1. 组件 ≤300 行（Sidebar/Editor 可放宽）
2. 开发基于 bun dev 与 bun dev:tauri
3. 全局状态用 zustand，局部用 useState
4. 注释只解释 Why，不解释 What
5. shadcn/hooks 由 autoimport 处理
6. 每个模块独立运行不要有耦合关系
7. 永远不要手动写 import 语句！
8. 项目已开启全面 auto-import（components、composables、utils、stores 等全部自动可用，新的引入自行添加到 config）
9. 除非是 node_modules 里的第三方包，否则禁止出现任何 import XXX from '...' 语句，除了图标需要 import 之外
10. 所有交互控件严禁直接手动编写，而是使用 “shadcn vue” 组件，没有应该到官网查找，例如：`npx shadcn-vue@latest add slider`，严禁 AI 冒充编写 shadcn vue 组件
11. dev 脚本运行的: port 6001
12. 项目不需要 build
13. 项目功能要兼容 tauri 与 utools

---

## 欢迎页定义

- 欢迎页 = “开始页面”，提供搜索、打开本地文件夹、新建页面等入口
- 欢迎页不是空白页
- 初始页（“准备好记录想法了吗？”）路径：src/pages/workspace/components/page/PageEmptyState.tsx

