import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Search as SearchIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "基础操作",
    shortcuts: [
      { keys: ["⌘", "K"], description: "打开搜索/命令面板" },
      { keys: ["⌘", "/"], description: "查看快捷键" },
      { keys: ["⌘", "⌥", "P"], description: "新建页面" },
      { keys: ["⌘", "Backspace"], description: "删除当前页面" },
      { keys: ["⌘", "S"], description: "保存文档" },
    ],
  },
  {
    title: "文本编辑",
    shortcuts: [
      { keys: ["⌘", "B"], description: "粗体" },
      { keys: ["⌘", "I"], description: "斜体" },
      { keys: ["⌘", "U"], description: "下划线" },
      { keys: ["⌘", "D"], description: "复制当前行" },
      { keys: ["⌘", "Shift", "D"], description: "删除当前行" },
      { keys: ["⌘", "/"], description: "插入代码块" },
      { keys: ["⌘", "E"], description: "应用行内代码" },
    ],
  },
  {
    title: "格式化",
    shortcuts: [
      { keys: ["/"], description: "打开命令菜单" },
      { keys: ["Space"], description: "打开 AI 助手" },
      { keys: ["⌘", "Alt", "0"], description: "普通段落" },
      { keys: ["⌘", "Alt", "1"], description: "一级标题" },
      { keys: ["⌘", "Alt", "2"], description: "二级标题" },
      { keys: ["⌘", "Alt", "3"], description: "三级标题" },
      { keys: ["⌘", "Shift", "7"], description: "有序列表" },
      { keys: ["⌘", "Shift", "8"], description: "无序列表" },
      { keys: ["⌘", "Shift", "9"], description: "任务列表" },
      { keys: ["⌘", "Shift", ">"], description: "引用块" },
    ],
  },
  {
    title: "表格操作",
    shortcuts: [
      { keys: ["Tab"], description: "下一个单元格" },
      { keys: ["⇧", "Tab"], description: "上一个单元格" },
      { keys: ["⌘", "Enter"], description: "在下方插入行" },
    ],
  },
  {
    title: "导航",
    shortcuts: [
      { keys: ["⌘", "A"], description: "全选（智能）" },
      { keys: ["⌘", "Z"], description: "撤销" },
      { keys: ["⌘", "⇧", "Z"], description: "重做" },
      { keys: ["⌘", "Y"], description: "重做" },
    ],
  },
];

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutDialog({ open, onOpenChange }: ShortcutDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return shortcutGroups;

    return shortcutGroups
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          (shortcut) =>
            shortcut.description
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            shortcut.keys.join(" ").toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((group) => group.shortcuts.length > 0);
  }, [searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">快捷键</h2>
            <p className="text-sm text-muted-foreground mt-1">
              查看所有可用的键盘快捷键
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-4 border-b bg-muted/30">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索快捷键..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* 快捷键列表 */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {filteredGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span
                            key={i}
                            className={cn(
                              "px-2 py-1 text-xs font-medium rounded",
                              "bg-muted border shadow-sm",
                              "group-hover:bg-background group-hover:border-primary/30",
                              "transition-all min-w-[28px] text-center"
                            )}
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filteredGroups.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">未找到匹配的快捷键</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
