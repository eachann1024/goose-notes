import { EmojiPicker } from "frimousse";
import { useEffect, useRef } from "react";

interface IconSelectorProps<T extends HTMLElement = HTMLElement> {
  value?: string;
  onChange: (icon: string | undefined) => void;
  children: React.ReactNode;
  portalContainerRef?: React.RefObject<T | null>;
  onFirstOpen?: () => void;
  emojiOnly?: boolean;
  scope?: "file" | "general";
}

// 文件图标白名单：仅保留适合页面/文档语义的图标
const FILE_ICONS = [
  "File",
  "FileText",
  "Folder",
  "FolderOpen",
  "Archive",
  "Clipboard",
  "Calendar",
  "Clock",
  "Target",
  "Flag",
  "Bookmark",
  "Tag",
  "Check",
  "HelpCircle",
  "Link",
  "Paperclip",
  "Book",
  "BookOpen",
  "GraduationCap",
  "Lightbulb",
  "Pen",
  "Pencil",
  "Calculator",
  "Ruler",
  "Briefcase",
  "Database",
  "HardDrive",
  "Server",
  "Lock",
  "Unlock",
  "Key",
  "MapPin",
  "Globe",
  "Package",
  "Box",
];

// 通用图标白名单：在文件图标基础上补充更多生活化选项
const GENERAL_ICONS = [
  ...FILE_ICONS,
  "Star",
  "Heart",
  "Mail",
  "MessageSquare",
  "Phone",
  "Bell",
  "Image",
  "Video",
  "Music",
  "Camera",
  "Coffee",
  "Gift",
  "ShoppingBag",
  "ShoppingCart",
  "CreditCard",
  "Map",
  "Car",
  "Plane",
  "Rocket",
  "Sun",
  "Moon",
  "Cloud",
  "Zap",
  "Flame",
  "Umbrella",
  "TreeDeciduous",
  "Palette",
];

const FILE_EMOJIS = [
  "📝", "📄", "📑", "📋", "📌", "📍", "🔖", "🏷️", "✅", "☑️",
  "📂", "📁", "🗂️", "📚", "📖", "📘", "📗", "📙", "📒", "📓",
  "💡", "🧠", "🎯", "⭐", "✨", "🔥", "🚩", "⚠️", "❗", "❓",
  "🔔", "⏰", "📅", "🗓️", "📆", "🧾", "📊", "📈", "📉", "🔍",
  "🔎", "🧪", "⚙️", "🔧", "🔒", "🔓", "🔗", "🌐",
];

const GENERAL_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
  "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
  "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
  "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟",
  "🤙", "👈", "👉", "👆", "👇", "👍", "👎", "✊", "👊", "🤛",
  "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳",
  "💪", "🧠", "👀", "👁", "👅", "👄", "💋", "❤", "🧡", "💛",
  "💚", "💙", "💜", "🤎", "🖤", "🤍", "💔", "❣", "💕", "💞",
  "💓", "💗", "💖", "💘", "💝", "🐶", "🐱", "🐭", "🐹", "🐰",
  "🐻", "🧸", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
  "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒",
  "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🌶", "🥕",
  "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
  "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐",
  "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪",
];

const NOTION_TABS = [
  { id: "emoji", label: "表情" },
  { id: "icon", label: "图标" },
] as const;

export function IconSelector<T extends HTMLElement = HTMLElement>({
  value,
  onChange,
  children,
  portalContainerRef,
  onFirstOpen,
  emojiOnly = false,
  scope = "general",
}: IconSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const portalContainer = portalContainerRef?.current ?? undefined;
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (emojiOnly) setTab("emoji");
  }, [emojiOnly]);

  const filteredIcons = useMemo(() => {
    const iconPool = scope === "file" ? FILE_ICONS : GENERAL_ICONS;
    const icons = Array.from(new Set(iconPool)).filter((key) => {
      if (!LucideIcons || !(key in (LucideIcons as any))) return false;
      return true;
    });
    return icons.slice(0, 200);
  }, [scope]);

  const randomEmojiPool = scope === "file" ? FILE_EMOJIS : GENERAL_EMOJIS;

  // 第一次打开时触发 onFirstOpen 回调
  useEffect(() => {
    if (open && !hasOpenedRef.current && onFirstOpen) {
      hasOpenedRef.current = true;
      onFirstOpen();
    }
  }, [open, onFirstOpen]);

  const handleRandomIcon = () => {
    if (tab === "icon") {
      if (filteredIcons.length === 0) return;
      const randomIcon =
        filteredIcons[Math.floor(Math.random() * filteredIcons.length)];
      onChange(randomIcon);
    } else {
      if (randomEmojiPool.length === 0) return;
      const randomEmoji =
        randomEmojiPool[Math.floor(Math.random() * randomEmojiPool.length)];
      onChange(randomEmoji);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 rounded-xl shadow-xl overflow-hidden bg-background text-foreground border border-border"
        align="start"
        side="bottom"
        collisionPadding={10}
        container={portalContainer}
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-3 pt-2 pb-2 text-[14px] border-b bg-background dark:bg-background backdrop-blur-[1px] sticky top-0 z-10">
          <div className="flex gap-4">
            {!emojiOnly &&
              NOTION_TABS.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto rounded-none border-b-2 px-1 pb-1 text-sm transition-colors duration-150",
                    tab === t.id
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab(t.id as any)}
                >
                  {t.label}
                </Button>
              ))}
            {emojiOnly && (
              <div className="pb-1 border-b-2 border-primary font-medium text-foreground px-1 text-sm">
                表情符号
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted/70 hover:text-foreground"
                    aria-label="随机图标"
                    onClick={handleRandomIcon}
                  >
                    <LucideIcons.Shuffle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">随机图标</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              移除
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="h-[360px]">
          {tab === "emoji" && (
            <EmojiPicker.Root
              className="isolate flex h-full flex-col bg-background"
              onEmojiSelect={({ emoji }) => {
                onChange(emoji);
                setOpen(false);
              }}
              columns={8}
            >
              <EmojiPicker.Search
                placeholder="搜索表情"
                className="z-10 mx-3 mt-2 appearance-none rounded-md bg-muted/50 px-3 py-2 text-sm border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <EmojiPicker.Viewport className="relative flex-1 outline-hidden" style={{ scrollbarGutter: "auto" }}>
                <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  加载中…
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  未找到表情
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  className="select-none px-3 pb-2"
                  components={{
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-accent data-[active]:bg-accent transition-colors"
                        {...props}
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          )}

          {tab === "icon" && (
            <ScrollArea className="h-full bg-background">
              <TooltipProvider delayDuration={0}>
                <div className="p-3 grid grid-cols-4 gap-1 bg-background">
                  {filteredIcons.map((iconName) => {
                    const Icon = (LucideIcons as any)[iconName];
                    return (
                      <Tooltip key={iconName}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "aspect-square h-auto w-full rounded-md p-0 transition-all duration-150 hover:bg-muted [&_svg]:size-8",
                              value === iconName &&
                                "bg-accent text-accent-foreground shadow-sm",
                            )}
                            onClick={() => {
                              onChange(iconName);
                              setOpen(false);
                            }}
                            aria-label={iconName}
                          >
                            <Icon className="stroke-[1.5]" />
                          </Button>
                        </TooltipTrigger>
                      </Tooltip>
                    );
                  })}
                  {filteredIcons.length === 0 && (
                    <div className="col-span-4 text-center py-12 text-sm text-muted-foreground">
                      未找到匹配的图标
                    </div>
                  )}
                </div>
              </TooltipProvider>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
