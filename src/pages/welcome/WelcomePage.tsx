import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { WelcomeShortcutsCard } from "./WelcomeShortcutsCard";
import * as Copy from "./welcomeCopy";

export function WelcomePage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [switchStates, setSwitchStates] = useState({
    notifications: true,
    autoSave: false,
    darkMode: true,
  });
  const [togglePressed, setTogglePressed] = useState(false);
  const [selectedTab, setSelectedTab] = useState("account");

  const handleButtonClick = () => {
    toast.success(Copy.TOAST_BUTTON_SUCCESS, {
      description: Copy.TOAST_BUTTON_SUCCESS_DESC,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextareaValue(e.target.value);
  };

  const handleSwitchChange = (key: string, checked: boolean) => {
    setSwitchStates((prev) => ({ ...prev, [key]: checked }));
    toast.info(Copy.TOAST_SWITCH_TOGGLED(key, checked));
  };

  const navigateToSubPage = () => {
    navigate("/welcome/sub-page");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <ScrollArea className="h-screen">
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          {/* 头部区域 */}
          <div className="text-center space-y-4 py-12">
            <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <LucideIcons.Sparkles className="h-16 w-16 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {Copy.APP_TITLE}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {Copy.APP_DESCRIPTION}
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" onClick={navigateToSubPage} className="shadow-lg">
                <LucideIcons.ArrowRight className="mr-2 h-5 w-5" />
                {Copy.BTN_GO_SUBPAGE}
              </Button>
              <Button size="lg" variant="outline" onClick={handleButtonClick}>
                <LucideIcons.Heart className="mr-2 h-5 w-5" />
                {Copy.BTN_LIKE}
              </Button>
            </div>
          </div>

          <Separator className="my-8" />

          {/* 按钮组件展示 */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LucideIcons.MousePointer2 className="h-5 w-5 text-blue-500" />
                {Copy.BUTTON_CARD_TITLE}
              </CardTitle>
              <CardDescription>{Copy.BUTTON_CARD_DESC}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleButtonClick}>默认按钮</Button>
                <Button variant="secondary">次要按钮</Button>
                <Button variant="destructive">危险按钮</Button>
                <Button variant="outline">轮廓按钮</Button>
                <Button variant="ghost">幽灵按钮</Button>
                <Button variant="link">链接按钮</Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm">小按钮</Button>
                <Button size="default">默认大小</Button>
                <Button size="lg">大按钮</Button>
                <Button size="icon">
                  <LucideIcons.Star className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button disabled>禁用按钮</Button>
                <Button>
                  <LucideIcons.Download className="mr-2 h-4 w-4" />
                  带图标
                </Button>
                <Button variant="outline">
                  <LucideIcons.Github className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 输入组件展示 */}
          <div className="grid md:grid-cols-2 gap-6">
            <WelcomeShortcutsCard
              inputValue={inputValue}
              textareaValue={textareaValue}
              onInputChange={handleInputChange}
              onTextareaChange={handleTextareaChange}
            />

            {/* 开关和切换组件展示 */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideIcons.ToggleLeft className="h-5 w-5 text-purple-500" />
                  {Copy.TOGGLE_CARD_TITLE}
                </CardTitle>
                <CardDescription>{Copy.TOGGLE_CARD_DESC}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">启用通知</Label>
                  <Switch
                    id="notifications"
                    checked={switchStates.notifications}
                    onCheckedChange={(checked) => handleSwitchChange("notifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="autosave">自动保存</Label>
                  <Switch
                    id="autosave"
                    checked={switchStates.autoSave}
                    onCheckedChange={(checked) => handleSwitchChange("autoSave", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="darkmode">深色模式</Label>
                  <Switch
                    id="darkmode"
                    checked={switchStates.darkMode}
                    onCheckedChange={(checked) => handleSwitchChange("darkMode", checked)}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>切换按钮</Label>
                  <div className="flex gap-2">
                    <Toggle
                      pressed={togglePressed}
                      onPressedChange={setTogglePressed}
                      aria-label="Toggle bold"
                    >
                      <LucideIcons.Bold className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                      pressed={false}
                      aria-label="Toggle italic"
                    >
                      <LucideIcons.Italic className="h-4 w-4" />
                    </Toggle>
                    <Toggle
                      pressed={false}
                      aria-label="Toggle underline"
                    >
                      <LucideIcons.Underline className="h-4 w-4" />
                    </Toggle>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 选项卡组件展示 */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LucideIcons.LayoutGrid className="h-5 w-5 text-orange-500" />
                {Copy.TABS_CARD_TITLE}
              </CardTitle>
              <CardDescription>{Copy.TABS_CARD_DESC}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="account">账户</TabsTrigger>
                  <TabsTrigger value="settings">设置</TabsTrigger>
                  <TabsTrigger value="about">关于</TabsTrigger>
                </TabsList>
                <TabsContent value="account" className="space-y-4">
                  <div className="space-y-2">
                    <Label>账户名称</Label>
                    <Input defaultValue="Goose Note User" />
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <Input type="email" defaultValue="user@goosenote.com" />
                  </div>
                  <Button>保存更改</Button>
                </TabsContent>
                <TabsContent value="settings" className="space-y-4">
                  <p className="text-sm text-muted-foreground">在这里配置应用设置</p>
                  <div className="space-y-2">
                    <Label>主题颜色</Label>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-500 cursor-pointer border-2 border-offset-2 border-blue-500" />
                      <div className="h-8 w-8 rounded-full bg-green-500 cursor-pointer" />
                      <div className="h-8 w-8 rounded-full bg-purple-500 cursor-pointer" />
                      <div className="h-8 w-8 rounded-full bg-orange-500 cursor-pointer" />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="about" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {Copy.TAB_ABOUT_DESC}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <LucideIcons.Info className="h-4 w-4" />
                    <span>版本: {Copy.VERSION}</span>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 弹出层组件展示 */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-lg border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideIcons.MessageSquare className="h-5 w-5 text-red-500" />
                  {Copy.DIALOG_CARD_TITLE}
                </CardTitle>
                <CardDescription>{Copy.DIALOG_CARD_DESC}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <LucideIcons.CirclePlus className="mr-2 h-4 w-4" />
                      打开对话框
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{Copy.DIALOG_CONFIRM_TITLE}</DialogTitle>
                      <DialogDescription>
                        {Copy.DIALOG_CONFIRM_DESC}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground">
                        {Copy.DIALOG_CONFIRM_BODY}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline">取消</Button>
                      <Button>确认</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">
                      <LucideIcons.Sidebar className="mr-2 h-4 w-4" />
                      打开侧边栏
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>{Copy.SHEET_TITLE}</SheetTitle>
                      <SheetDescription>
                        {Copy.SHEET_DESC}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {Copy.SHEET_BODY}
                      </p>
                      <Separator />
                      <div className="space-y-2">
                        <Label>选项 1</Label>
                        <Input placeholder="输入内容..." />
                      </div>
                      <div className="space-y-2">
                        <Label>选项 2</Label>
                        <Textarea placeholder="输入描述..." rows={3} />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideIcons.Layers className="h-5 w-5 text-cyan-500" />
                  {Copy.POPOVER_CARD_TITLE}
                </CardTitle>
                <CardDescription>{Copy.POPOVER_CARD_DESC}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <LucideIcons.Popcorn className="mr-2 h-4 w-4" />
                      打开弹出框
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <h4 className="font-medium">弹出框内容</h4>
                      <p className="text-sm text-muted-foreground">
                        {Copy.POPOVER_BODY}
                      </p>
                      <div className="space-y-2">
                        <Label>快速输入</Label>
                        <Input placeholder="快速输入..." />
                      </div>
                      <Button size="sm" className="w-full">
                        确认
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <LucideIcons.Menu className="mr-2 h-4 w-4" />
                      下拉菜单
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <LucideIcons.User className="mr-2 h-4 w-4" />
                      <span>个人资料</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LucideIcons.CreditCard className="mr-2 h-4 w-4" />
                      <span>账单</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LucideIcons.Settings className="mr-2 h-4 w-4" />
                      <span>设置</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <LucideIcons.LogOut className="mr-2 h-4 w-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">
                        <LucideIcons.HelpCircle className="mr-2 h-4 w-4" />
                        带提示的按钮
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{Copy.TOOLTIP_TEXT}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          {/* 交互式卡片网格 */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LucideIcons.LayoutGrid className="h-5 w-5 text-pink-500" />
                {Copy.FEATURE_CARD_TITLE}
              </CardTitle>
              <CardDescription>{Copy.FEATURE_CARD_DESC}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
                  <CardHeader className="pb-3">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-2">
                      <LucideIcons.FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-lg">{Copy.FEATURE_EDIT_TITLE}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {Copy.FEATURE_EDIT_DESC}
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
                  <CardHeader className="pb-3">
                    <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-2">
                      <LucideIcons.FolderOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-lg">{Copy.FEATURE_FOLDER_TITLE}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {Copy.FEATURE_FOLDER_DESC}
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
                  <CardHeader className="pb-3">
                    <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-2">
                      <LucideIcons.Palette className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <CardTitle className="text-lg">{Copy.FEATURE_THEME_TITLE}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {Copy.FEATURE_THEME_DESC}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* 底部提示 */}
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">
              {Copy.FOOTER_TEXT}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
