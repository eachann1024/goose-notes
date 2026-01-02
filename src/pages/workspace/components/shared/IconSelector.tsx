
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'


interface IconSelectorProps<T extends HTMLElement = HTMLElement> {
    value?: string
    onChange: (icon: string | undefined) => void
    children: React.ReactNode
    portalContainerRef?: React.RefObject<T | null>
}

export function IconSelector<T extends HTMLElement = HTMLElement>({
    value,
    onChange,
    children,
    portalContainerRef,
}: IconSelectorProps<T>) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [tab, setTab] = useState<'emoji' | 'icon'>('emoji')
    const portalContainer = portalContainerRef?.current ?? undefined

    const filteredIcons = useMemo(() => {
        if (!search) return Object.keys(LucideIcons).filter(key => key !== 'icons' && key !== 'createLucideIcon' && isNaN(Number(key))).slice(0, 300)

        return Object.keys(LucideIcons)
            .filter(key => key.toLowerCase().includes(search.toLowerCase()) && key !== 'icons' && key !== 'createLucideIcon' && isNaN(Number(key)))
            .slice(0, 50)
    }, [search])



    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                className="w-[340px] p-0"
                align="start"
                side="right"
                collisionPadding={10}
                container={portalContainer}
            >
                <div className="flex border-b">
                     <button
                        className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'emoji' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setTab('emoji')}
                     >
                        表情符号
                     </button>
                     <button
                        className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'icon' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setTab('icon')}
                     >
                        图标
                     </button>
                </div>

                <div className="h-[320px] ">
                    {tab === 'emoji' ? (
                        <div className="w-full h-full">
                             <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                    onChange(emojiData.emoji)
                                    setOpen(false)
                                }}
                                width="100%"
                                height="100%"
                                searchDisabled={false}
                                skinTonesDisabled
                                previewConfig={{ showPreview: false }}
                                theme={Theme.AUTO}
                                emojiStyle={EmojiStyle.APPLE}
                            />
                        </div>
                    ) : (
                         <div className="flex flex-col h-full">
                             <div className="flex items-center border-b px-3 pb-2 pt-3">
                                <LucideIcons.Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-5 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                    placeholder="搜索图标..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-2 grid grid-cols-6 gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => {
                                            onChange(undefined)
                                            setOpen(false)
                                        }}
                                        title="Remove Icon"
                                    >
                                        <LucideIcons.X className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    {filteredIcons.map((iconName) => {
                                        const Icon = (LucideIcons as any)[iconName]
                                        return (
                                            <button
                                                key={iconName}
                                                className={cn(
                                                    "flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted",
                                                    value === iconName && "bg-accent text-accent-foreground"
                                                )}
                                                onClick={() => {
                                                    onChange(iconName)
                                                    setOpen(false)
                                                }}
                                                title={iconName}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </button>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
