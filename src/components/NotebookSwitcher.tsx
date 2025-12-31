import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNotebooks } from '@/stores/useNotebooks'
import { usePages } from '@/stores/usePages'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Plus, Check, Settings, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { IconSelector } from '@/components/IconSelector' // Moved to lazy load
import * as LucideIcons from "lucide-react"

const IconSelector = lazy(() => import('@/components/IconSelector').then(module => ({ default: module.IconSelector })))

export function NotebookSwitcher() {
  const { notebooks, activeNotebookId, setActiveNotebook, createNotebook, updateNotebook, deleteNotebook, getLastActivePage } = useNotebooks()
  const { setActivePage } = usePages()
  const [isOpen, setIsOpen] = useState(false)
  const editDialogContentRef = useRef<HTMLDivElement>(null)
  const createDialogContentRef = useRef<HTMLDivElement>(null)
  
  // Edit Dialog State
  const [editDialog, setEditDialog] = useState<{ open: boolean; id: string; name: string; icon: string }>({
    open: false,
    id: '',
    name: '',
    icon: '',
  })

  // Create Dialog State
  const [createDialog, setCreateDialog] = useState<{ open: boolean; name: string; icon: string; error: string }>({
    open: false,
    name: '',
    icon: '📓',
    error: '',
  })

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')

  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null
  const notebookList = Object.values(notebooks).sort((a, b) => a.createdAt - b.createdAt)

  // Reset states when dialog closes
  useEffect(() => {
    if (!editDialog.open) {
      setShowDeleteConfirm(false)
      setDeleteConfirmInput('')
    }
  }, [editDialog.open])

  const handleCreate = () => {
    setCreateDialog({ open: true, name: '', icon: '📓', error: '' })
    setIsOpen(false)
  }

  const handleConfirmCreate = () => {
    // 验证名称不能为空
    if (!createDialog.name.trim()) {
      setCreateDialog({ ...createDialog, error: '请输入记事本名称' })
      return
    }

    // 验证名称不能重复
    const nameExists = Object.values(notebooks).some(
      nb => nb.name.toLowerCase() === createDialog.name.trim().toLowerCase()
    )
    if (nameExists) {
      setCreateDialog({ ...createDialog, error: '记事本名称已存在' })
      return
    }

    // 创建记事本（一次性传入名称和图标）
    createNotebook(createDialog.name.trim(), createDialog.icon)
    // 新建记事本显示空白页（不自动创建页面）
    setActivePage(null)

    setCreateDialog({ open: false, name: '', icon: '📓', error: '' })
  }

  const handleEdit = (id: string) => {
    const notebook = notebooks[id]
    if (notebook) {
      setEditDialog({
        open: true,
        id,
        name: notebook.name,
        icon: notebook.icon || '📓',
      })
    }
  }

  const handleSaveEdit = () => {
    if (editDialog.id) {
      updateNotebook(editDialog.id, {
        name: editDialog.name,
        icon: editDialog.icon,
      })
    }
    setEditDialog({ ...editDialog, open: false })
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    if (editDialog.id && editDialog.id !== 'default-notebook') {
       if (deleteConfirmInput === editDialog.name) {
          deleteNotebook(editDialog.id)
          setEditDialog({ ...editDialog, open: false })
       }
    }
  }

  const isDeleteEnabled = deleteConfirmInput === editDialog.name

  // Rendering the Icon (Emoji or Lucide)
  const renderIcon = (iconStr: string, className?: string) => {
      // Check if it's a lucide icon
      if (iconStr && !iconStr.match(/\p{Emoji}/u) && (LucideIcons as any)[iconStr]) {
          const IconComp = (LucideIcons as any)[iconStr];
          return <IconComp className={cn("h-4 w-4", className)} />;
      }
      return <span className={cn("text-base leading-none", className)}>{iconStr || '📓'}</span>;
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 h-9 font-medium"
          >
            <div className="flex items-center gap-2 truncate">
              {activeNotebook && renderIcon(activeNotebook.icon || '📓')}
              <span className="truncate">{activeNotebook?.name || '选择记事本'}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {notebookList.map((notebook) => (
            <DropdownMenuItem
              key={notebook.id}
              className="flex items-center justify-between group"
              onClick={() => {
                setActiveNotebook(notebook.id)
                // 恢复该记事本的上次页面，或显示空白
                const lastPageId = getLastActivePage(notebook.id)
                setActivePage(lastPageId)
                setIsOpen(false)
              }}
            >
              <div className="flex items-center gap-2">
                 {renderIcon(notebook.icon || '📓')}
                <span className="truncate">{notebook.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {activeNotebookId === notebook.id && (
                  <Check className="h-4 w-4" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                    activeNotebookId === notebook.id && "opacity-0"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(notebook.id)
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建记事本
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 编辑记事本对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent ref={editDialogContentRef} className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{showDeleteConfirm ? '永久删除记事本？' : '编辑记事本'}</DialogTitle>
            {showDeleteConfirm && (
                <DialogDescription className="text-destructive pt-2">
                    此操作无法撤销。这将永久删除该记事本及其所有内容。
                </DialogDescription>
            )}
          </DialogHeader>

          {showDeleteConfirm ? (
            <div className="py-6">
               <div className="grid gap-2">
                 <Label htmlFor="confirm-delete" className="text-muted-foreground">
                     请输入 <span className="font-bold text-foreground select-all">{editDialog.name}</span> 以确认删除
                 </Label>
                 <Input
                   id="confirm-delete"
                   value={deleteConfirmInput}
                   onChange={(e) => setDeleteConfirmInput(e.target.value)}
                   placeholder={editDialog.name}
                   className="w-full h-11"
                   autoFocus
                 />
               </div>
            </div>
          ) : (
            <div className="py-6">
              <div className="flex items-center gap-3">
                  <Suspense fallback={<Button variant="outline" className="h-12 w-12 flex items-center justify-center">...</Button>}>
                  <IconSelector 
                      value={editDialog.icon}
                      onChange={(val) => setEditDialog({ ...editDialog, icon: val || '📓' })}
                      portalContainerRef={editDialogContentRef}
                  >
                      <Button 
                          variant="outline" 
                          className="h-12 w-12 p-0 flex items-center justify-center shrink-0 text-xl shadow-sm"
                      >
                           {renderIcon(editDialog.icon)}
                      </Button>
                  </IconSelector>
                  </Suspense>
                  <Input
                    id="notebook-name"
                    value={editDialog.name}
                    onChange={(e) => setEditDialog({ ...editDialog, name: e.target.value })}
                    placeholder="记事本名称"
                    className="h-12 flex-1 text-base shadow-sm"
                  />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            {showDeleteConfirm ? (
                <div className="flex w-full justify-between">
                     <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                        取消
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleConfirmDelete}
                        disabled={!isDeleteEnabled}
                    >
                        确认删除
                    </Button>
                </div>
            ) : (
                <div className="flex w-full justify-between items-center">
                    {editDialog.id !== 'default-notebook' ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteClick}
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                        </Button>
                    ) : (
                         <div /> /* Spacer */
                    )}
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditDialog({ ...editDialog, open: false })}>
                            取消
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>保存</Button>
                    </div>
                </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建记事本对话框 */}
      <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ ...createDialog, open, error: '' })}>
        <DialogContent ref={createDialogContentRef} className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>新建记事本</DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {createDialog.error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
                {createDialog.error}
              </div>
            )}
            <div className="flex items-center gap-3">
                <Suspense fallback={<Button variant="outline" className="h-12 w-12 flex items-center justify-center">...</Button>}>
                <IconSelector
                  value={createDialog.icon}
                  onChange={(val) => setCreateDialog({ ...createDialog, icon: val || '📓' })}
                  portalContainerRef={createDialogContentRef}
                >
                  <Button
                    variant="outline"
                    className="h-12 w-12 p-0 flex items-center justify-center shrink-0 text-xl shadow-sm"
                  >
                    {renderIcon(createDialog.icon)}
                  </Button>
                </IconSelector>
                </Suspense>
                <Input
                  id="new-notebook-name"
                  value={createDialog.name}
                  onChange={(e) => setCreateDialog({ ...createDialog, name: e.target.value, error: '' })}
                  placeholder="输入记事本名称"
                  className="h-12 flex-1 text-base shadow-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleConfirmCreate()
                    }
                  }}
                />
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateDialog({ ...createDialog, open: false, error: '' })}>
                取消
              </Button>
              <Button size="sm" onClick={handleConfirmCreate}>创建</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
