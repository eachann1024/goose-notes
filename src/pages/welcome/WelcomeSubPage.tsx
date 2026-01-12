import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from "@/components/ui/context-menu";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
}

export function WelcomeSubPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "学习 Goose Note 基础功能", completed: true, priority: "high" },
    { id: "2", title: "创建我的第一个笔记", completed: false, priority: "high" },
    { id: "3", title: "探索快捷键功能", completed: false, priority: "medium" },
    { id: "4", title: "自定义主题设置", completed: false, priority: "low" },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCompleted, setShowCompleted] = useState(true);

  const addTask = () => {
    if (!newTaskTitle.trim()) {
      toast.error("请输入任务标题");
      return;
    }
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      completed: false,
      priority: "medium",
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
    toast.success("任务已添加");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
    toast.success("任务已删除");
  };

  const updateTaskPriority = (id: string, priority: Task["priority"]) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, priority } : task
    ));
    toast.success(`优先级已更新为: ${priority === "high" ? "高" : priority === "medium" ? "中" : "低"}`);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* 头部区域 */}
        <div className="space-y-4 py-8">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/welcome")}
              className="mb-4"
            >
              <LucideIcons.ArrowLeft className="mr-2 h-4 w-4" />
              返回欢迎页
            </Button>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <LucideIcons.LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <LucideIcons.List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl shadow-lg">
              <LucideIcons.CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                任务管理示例
              </h1>
              <p className="text-muted-foreground mt-1">
                这是子页面，展示了更复杂的交互和数据管理
              </p>
            </div>
          </div>

          {/* 进度统计 */}
          <Card className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">完成进度</p>
                  <p className="text-2xl font-bold">
                    {completedCount} / {totalCount} 任务
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        completedCount === totalCount
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-green-500 to-teal-500"
                      )}
                      style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium min-w-[3rem]">
                    {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 添加任务区域 */}
        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LucideIcons.PlusCircle className="h-5 w-5 text-green-500" />
              添加新任务
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="newTask">任务标题</Label>
                <Input
                  id="newTask"
                  placeholder="输入新任务..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTask()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addTask} size="lg" className="px-8">
                  <LucideIcons.Plus className="mr-2 h-4 w-4" />
                  添加
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showCompleted"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="showCompleted">显示已完成任务</Label>
            </div>
          </CardContent>
        </Card>

        {/* 任务列表 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LucideIcons.ListTodo className="h-6 w-6 text-teal-500" />
            任务列表
            <span className="text-sm font-normal text-muted-foreground">
              (右键点击任务查看更多操作)
            </span>
          </h2>

          {viewMode === "grid" ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks
                .filter(task => showCompleted || !task.completed)
                .map((task) => (
                  <ContextMenu key={task.id}>
                    <ContextMenuTrigger asChild>
                      <Card
                        className={cn(
                          "hover:shadow-lg transition-all cursor-pointer border-2",
                          task.completed && "opacity-60",
                          task.priority === "high" && "border-red-300 dark:border-red-800",
                          task.priority === "medium" && "border-yellow-300 dark:border-yellow-800",
                          task.priority === "low" && "border-green-300 dark:border-green-800"
                        )}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div
                              className={cn(
                                "flex-1",
                                task.completed && "line-through text-muted-foreground"
                              )}
                            >
                              <CardTitle className="text-base">{task.title}</CardTitle>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleTask(task.id)}
                            >
                              {task.completed ? (
                                <LucideIcons.CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <LucideIcons.Circle className="h-5 w-5" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-full font-medium",
                                task.priority === "high" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                                task.priority === "medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                                task.priority === "low" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              )}
                            >
                              {task.priority === "high" ? "高优先级" : task.priority === "medium" ? "中优先级" : "低优先级"}
                            </span>
                            <span className="text-muted-foreground">
                              {task.completed ? "已完成" : "进行中"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuLabel>任务操作</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => toggleTask(task.id)}>
                        <LucideIcons.Check className="mr-2 h-4 w-4" />
                        {task.completed ? "标记为未完成" : "标记为完成"}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuLabel>更改优先级</ContextMenuLabel>
                      <ContextMenuRadioGroup
                        value={task.priority}
                        onValueChange={(value) => updateTaskPriority(task.id, value as Task["priority"])}
                      >
                        <ContextMenuRadioItem value="high">
                          <LucideIcons.AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                          高优先级
                        </ContextMenuRadioItem>
                        <ContextMenuRadioItem value="medium">
                          <LucideIcons.MinusCircle className="mr-2 h-4 w-4 text-yellow-500" />
                          中优先级
                        </ContextMenuRadioItem>
                        <ContextMenuRadioItem value="low">
                          <LucideIcons.ArrowDownCircle className="mr-2 h-4 w-4 text-green-500" />
                          低优先级
                        </ContextMenuRadioItem>
                      </ContextMenuRadioGroup>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-red-600"
                        onClick={() => deleteTask(task.id)}
                      >
                        <LucideIcons.Trash2 className="mr-2 h-4 w-4" />
                        删除任务
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
            </div>
          ) : (
            <Card className="shadow-lg border-2">
              <CardContent className="p-0">
                <div className="divide-y">
                  {tasks
                    .filter(task => showCompleted || !task.completed)
                    .map((task) => (
                      <ContextMenu key={task.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                              task.completed && "opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => toggleTask(task.id)}
                              >
                                {task.completed ? (
                                  <LucideIcons.CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <LucideIcons.Circle className="h-5 w-5" />
                                )}
                              </Button>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    "font-medium truncate",
                                    task.completed && "line-through text-muted-foreground"
                                  )}
                                >
                                  {task.title}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium flex-shrink-0",
                                  task.priority === "high" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                                  task.priority === "medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                                  task.priority === "low" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                )}
                              >
                                {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
                              </span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuLabel>任务操作</ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => toggleTask(task.id)}>
                            <LucideIcons.Check className="mr-2 h-4 w-4" />
                            {task.completed ? "标记为未完成" : "标记为完成"}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuLabel>更改优先级</ContextMenuLabel>
                          <ContextMenuRadioGroup
                            value={task.priority}
                            onValueChange={(value) => updateTaskPriority(task.id, value as Task["priority"])}
                          >
                            <ContextMenuRadioItem value="high">高优先级</ContextMenuRadioItem>
                            <ContextMenuRadioItem value="medium">中优先级</ContextMenuRadioItem>
                            <ContextMenuRadioItem value="low">低优先级</ContextMenuRadioItem>
                          </ContextMenuRadioGroup>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="text-red-600"
                            onClick={() => deleteTask(task.id)}
                          >
                            <LucideIcons.Trash2 className="mr-2 h-4 w-4" />
                            删除任务
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tasks.filter(task => showCompleted || !task.completed).length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <LucideIcons.Inbox className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">暂无任务</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 使用提示 */}
        <Card className="bg-gradient-to-r from-teal-500/10 to-green-500/10 border-teal-200 dark:border-teal-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LucideIcons.Lightbulb className="h-5 w-5 text-yellow-500" />
              使用提示
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 点击左侧圆圈或复选框来标记任务完成状态</p>
            <p>• 右键点击任务可以打开上下文菜单，进行更多操作</p>
            <p>• 使用右上角的按钮切换网格和列表视图</p>
            <p>• 可以通过右键菜单快速调整任务优先级</p>
          </CardContent>
        </Card>

        {/* 底部导航 */}
        <div className="flex justify-center py-8 gap-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/welcome")}>
            <LucideIcons.ArrowLeft className="mr-2 h-4 w-4" />
            返回欢迎页
          </Button>
          <Button size="lg" onClick={() => navigate("/")}>
            <LucideIcons.Home className="mr-2 h-4 w-4" />
            进入工作区
          </Button>
        </div>
      </div>
    </div>
  );
}
