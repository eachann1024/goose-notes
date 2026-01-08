export const TIPS = [
  "输入 / 可唤起命令菜单",
  "按 Shift + 粘贴 可粘贴纯文本，绕过 Markdown 解析",
  "粘贴 Markdown 格式文本会自动转换为富文本",
  "拖拽左侧手柄可调整段落顺序",
  "选中文字后出现格式工具栏",
  "⌘/Ctrl + S 无需手动保存，内容自动保存",
  "⌘/Ctrl + K 可快速搜索页面（uTools 输入会自动同步）",
  "⌘/Ctrl + +/- 可缩放页面",
  "双击图片可调整大小和对齐方式",
  "支持代码块语法高亮，输入 /code 插入",
  "设置 → 数据管理 可重置所有数据",
];

export function getRandomTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}
