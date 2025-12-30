import { useState } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useSettings } from "@/stores/useSettings"
import { Settings, Moon, Sun, Laptop } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'general' | 'appearance'

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, searchProviders, toggleSearchProvider } = useSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0 gap-0 overflow-hidden">
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
                      </div>
                   </div>
                 )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}