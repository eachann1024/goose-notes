import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { useSettings } from '@/stores/useSettings'
import { Settings, Moon, Sun, Laptop, RotateCcw, Code2 } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { CodeStyle } from '@/stores/useSettings'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'general' | 'appearance'

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, codeStyle, setCodeStyle, searchProviders, toggleSearchProvider, customFonts, setCustomLabel, setCustomFont, resetCustomFont, uiFontSize, setUIFontSize } = useSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  const codeStyles: { value: CodeStyle; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Goose 默认风格，现代极简' },
    { value: 'github', label: 'GitHub', description: '经典的开发者风格' },
    { value: 'modern', label: 'Modern', description: '柔和的原子风格 (One Dark/Light)' },
    { value: 'vivid', label: 'Vivid', description: '高对比度，色彩鲜艳 (Dracula)' },
    { value: 'night', label: 'Night', description: '赛博朋克风格 (Tokyo Night)' },
  ]

  const defaultLabels = { default: '默认', serif: '衬线体', mono: '等宽体' }
  const defaultFonts = { default: 'Inter', serif: 'Source Serif 4', mono: 'JetBrains Mono' }

  const getFontPreview = (type: 'default' | 'serif' | 'mono') => customFonts[type].font || defaultFonts[type]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* 无障碍：隐藏的标题和描述 */}
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">配置应用的设置选项</DialogDescription>
        <div className="flex bg-muted/30 h-full">
            {/* 左侧导航 */}
            <div className="w-48 border-r py-4 px-2 bg-muted/50">
                 <h2 className="px-2 text-xs font-semibold text-muted-foreground mb-2">设置</h2>
                 <div className="flex flex-col gap-1">
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "justify-start w-full",
                          activeTab === 'general' && "bg-accent/50"
                        )}
                        onClick={() => setActiveTab('general')}
                     >
                         <Settings className="mr-2 h-4 w-4" />
                         通用
                     </Button>
                     <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "justify-start w-full",
                          activeTab === 'appearance' && "bg-accent/50"
                        )}
                        onClick={() => setActiveTab('appearance')}
                     >
                         <Laptop className="mr-2 h-4 w-4" />
                         外观
                     </Button>
                 </div>
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 p-6 overflow-y-auto">
                 {/* 通用 Tab */}
                 {activeTab === 'general' && (
                   <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium">通用</h3>
                        <p className="text-sm text-muted-foreground">配置应用的通用设置。</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-3">搜索引擎</h4>
                        <p className="text-xs text-muted-foreground mb-4">配置右键菜单中显示的搜索引擎。</p>
                        <div className="space-y-3">
                          {searchProviders.map((provider) => (
                            <div key={provider.id} className="flex items-center justify-between">
                              <Label htmlFor={`provider-${provider.id}`} className="flex items-center gap-2 cursor-pointer">
                                  {provider.name}
                              </Label>
                              <Switch
                                  id={`provider-${provider.id}`}
                                  checked={provider.isEnabled}
                                  onCheckedChange={() => toggleSearchProvider(provider.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                   </div>
                 )}

                  {/* 外观 Tab */}
                  {activeTab === 'appearance' && (
                    <div className="space-y-6">
                       <div>
                          <h3 className="text-lg font-medium">外观</h3>
                          <p className="text-sm text-muted-foreground">自定义界面的外观和感觉。</p>
                       </div>

                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                              <Label htmlFor="dark-mode">深色模式</Label>
                              <div className="flex items-center gap-2 border rounded-full p-1 bg-muted">
                                  <Button
                                      size="icon"
                                      variant="ghost"
                                      className={`h-6 w-6 rounded-full ${theme === 'light' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setTheme('light')}
                                  >
                                      <Sun className="h-4 w-4" />
                                  </Button>
                                  <Button
                                      size="icon"
                                      variant="ghost"
                                      className={`h-6 w-6 rounded-full ${theme === 'dark' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setTheme('dark')}
                                  >
                                      <Moon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                      size="icon"
                                      variant="ghost"
                                      className={`h-6 w-6 rounded-full ${theme === 'system' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setTheme('system')}
                                  >
                                      <Laptop className="h-4 w-4" />
                                  </Button>
                              </div>
                           </div>

                          <div className="flex items-center justify-between">
                              <div>
                                <Label>界面字体大小</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">调整整体界面的文字大小</p>
                              </div>
                              <div className="flex items-center gap-2 border rounded-full p-1 bg-muted">
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-6 px-2 rounded-full text-xs ${uiFontSize === 'small' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setUIFontSize('small')}
                                  >
                                      缩小
                                  </Button>
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-6 px-2 rounded-full text-xs ${uiFontSize === 'normal' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setUIFontSize('normal')}
                                  >
                                      标准
                                  </Button>
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-6 px-2 rounded-full text-xs ${uiFontSize === 'large' ? 'bg-background shadow-sm' : ''}`}
                                      onClick={() => setUIFontSize('large')}
                                  >
                                      放大
                                  </Button>
                              </div>
                           </div>

                           <div className="pt-4 border-t">
                             <h4 className="text-sm font-medium mb-3">代码风格</h4>
                             <p className="text-xs text-muted-foreground mb-4">选择代码块的视觉风格（自动适配深浅模式）</p>

                             <div className="grid grid-cols-1 gap-2">
                               {codeStyles.map((t) => (
                                 <button
                                   key={t.value}
                                   onClick={() => setCodeStyle(t.value)}
                                   className={cn(
                                     "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                     "hover:bg-accent hover:border-accent",
                                     codeStyle === t.value && "border-primary bg-accent/50"
                                   )}
                                 >
                                   <Code2 className="h-5 w-5 shrink-0" />
                                   <div className="flex-1">
                                     <div className="text-sm font-medium">{t.label}</div>
                                     <div className="text-xs text-muted-foreground">{t.description}</div>
                                   </div>
                                   {codeStyle === t.value && (
                                     <div className="h-2 w-2 rounded-full bg-primary" />
                                   )}
                                 </button>
                               ))}
                             </div>
                           </div>

                           <div className="pt-4 border-t">
                            <h4 className="text-sm font-medium mb-1">自定义字体</h4>
                            <p className="text-xs text-muted-foreground mb-4">留空使用默认值，字体名需与系统已安装字体一致，多个字体名用逗号分隔</p>

                            <div className="space-y-4">
                              {(['default', 'serif', 'mono'] as const).map((type) => (
                                <div key={type} className="grid grid-cols-[80px_1fr_100px_40px] gap-3 items-center">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={customFonts[type].label || ''}
                                      onChange={(e) => setCustomLabel(type, e.target.value || null)}
                                      placeholder={defaultLabels[type]}
                                      className="h-8 text-sm px-2"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={customFonts[type].font || ''}
                                      onChange={(e) => setCustomFont(type, e.target.value || null)}
                                      placeholder={defaultFonts[type]}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div
                                    className="text-center text-2xl h-8 flex items-center justify-center"
                                    style={{ fontFamily: `"${customFonts[type].font}"` || getFontPreview(type) }}
                                  >
                                    Ag
                                  </div>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => resetCustomFont(type)}
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>恢复默认</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              ))}
                            </div>
                          </div>
                       </div>
                    </div>
                  )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}