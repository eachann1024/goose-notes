import EmojiPicker, { EmojiStyle, Theme, Categories } from "emoji-picker-react";
import { useEffect, useRef } from "react";

interface IconSelectorProps<T extends HTMLElement = HTMLElement> {
  value?: string;
  onChange: (icon: string | undefined) => void;
  children: React.ReactNode;
  portalContainerRef?: React.RefObject<T | null>;
  onFirstOpen?: () => void;
  emojiOnly?: boolean;
}

// 常用图标白名单（精简去除了非代表性的 UI 控件图标）
const COMMON_ICONS = [
  // 核心/通用
  "Home",
  "Search",
  "Menu",
  "Settings",
  "User",
  "Users",
  "Star",
  "Heart",
  "Flag",
  "Bookmark",
  "Tag",
  "Check",
  "X",
  "AlertCircle",
  "Info",
  "HelpCircle",
  "MoreHorizontal",
  
  // 文档/工作
  "File",
  "FileText",
  "Folder",
  "FolderOpen",
  "Archive",
  "Briefcase",
  "Clipboard",
  "Calendar",
  "Clock",
  "Target",
  "Award",
  "Trophy",
  "MapPin",
  "Link",
  "Paperclip",
  
  // 沟通/媒体
  "Mail",
  "MessageSquare",
  "MessageCircle",
  "Phone",
  "Bell",
  "Image",
  "Video",
  "Mic",
  "Music",
  "Camera",
  "Headphones",
  "Speaker",
  "Radio",
  
  // 科技/设备
  "Smartphone",
  "Laptop",
  "Monitor",
  "Cpu",
  "Database",
  "HardDrive",
  "Server",
  "Wifi",
  "Bluetooth",
  "Battery",
  "Tv",
  "Watch",
  
  // 生活/物品
  "Coffee",
  "CupSoda",
  "Pizza",
  "Cake",
  "Gift",
  "ShoppingBag",
  "ShoppingCart",
  "CreditCard",
  "Wallet",
  "Key",
  "Lock",
  "Unlock",
  "Map",
  "Globe",
  "Anchor",
  "Compass",
  "Package",
  "Box",
  "Truck",
  "Car",
  "Plane",
  "Rocket",
  
  // 自然/天气
  "Sun",
  "Moon",
  "Cloud",
  "CloudRain",
  "CloudSnow",
  "CloudLightning",
  "Zap",
  "Droplet",
  "Flame",
  "Wind",
  "Snowflake",
  "Umbrella",
  "Mountain",
  "TreeDeciduous",
  "TreePine",
  "Flower2",
  
  // 学术/工具
  "Book",
  "BookOpen",
  "GraduationCap",
  "Lightbulb",
  "Pen",
  "Pencil",
  "Calculator",
  "Ruler",
  "Hammer",
  "Wrench",
  "Puzzle",
  "Palette",
  "Glasses",
  "Scissors",
];

const POPULAR_EMOJIS = [
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

const AVAILABLE_ICONS = Array.from(new Set(COMMON_ICONS));

const NOTION_TABS = [
  { id: "emoji", label: "表情" },
  { id: "icon", label: "图标" },
] as const;

const EMOJI_CATEGORIES = [
  { category: Categories.SUGGESTED, name: "最近使用" },
  { category: Categories.SMILEYS_PEOPLE, name: "表情 & 人物" },
  { category: Categories.ANIMALS_NATURE, name: "动物 & 自然" },
  { category: Categories.FOOD_DRINK, name: "食物 & 饮品" },
  { category: Categories.TRAVEL_PLACES, name: "旅行 & 地点" },
  { category: Categories.ACTIVITIES, name: "活动" },
  { category: Categories.OBJECTS, name: "物品" },
  { category: Categories.SYMBOLS, name: "符号" },
  { category: Categories.FLAGS, name: "旗帜" },
];

export function IconSelector<T extends HTMLElement = HTMLElement>({
  value,
  onChange,
  children,
  portalContainerRef,
  onFirstOpen,
  emojiOnly = false,
}: IconSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const theme = useSettings((state) => state.theme);
  const portalContainer = portalContainerRef?.current ?? undefined;
  const hasOpenedRef = useRef(false);
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (emojiOnly) setTab("emoji");
  }, [emojiOnly]);

  const filteredIcons = useMemo(() => {
    const icons = AVAILABLE_ICONS.filter((key) => {
      if (!LucideIcons || !(key in (LucideIcons as any))) return false;
      return true;
    });
    return icons.slice(0, 200);
  }, []);

  // 第一次打开时触发 onFirstOpen 回调
  useEffect(() => {
    if (open && !hasOpenedRef.current && onFirstOpen) {
      hasOpenedRef.current = true;
      onFirstOpen();
    }
  }, [open, onFirstOpen]);

  const handleRandomIcon = () => {
    if (tab === "icon") {
      const randomIcon =
        AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
      onChange(randomIcon);
    } else {
       const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
       onChange(randomEmoji);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 rounded-xl shadow-xl overflow-hidden bg-background text-foreground border border-border"
        align="start"
        side="bottom"
        collisionPadding={10}
        container={portalContainer}
      >
        {/* Header Tabs */}
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
             <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted/70 hover:text-foreground"
                title="随机图标"
                onClick={handleRandomIcon}
             >
                <LucideIcons.Shuffle className="h-3.5 w-3.5" />
             </button>
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
            <div className="h-full w-full">
              <style>{`
                .emoji-picker-react-wrapper {
                   --epr-search-input-height: 40px !important;
                   --epr-category-navigation-button-size: 24px !important;
                   --epr-preview-height: 0px !important;
                }
                .emoji-picker-react {
                  width: 100% !important;
                  height: 100% !important;
                  border: none !important;
                  background: hsl(var(--background)) !important;
                  display: flex !important;
                  flex-direction: column !important;
                  --epr-bg-color: hsl(var(--background)) !important;
                  --epr-category-label-bg-color: hsl(var(--background)) !important;
                  --epr-picker-border-color: transparent !important;
                  --epr-text-color: hsl(var(--foreground)) !important;
                  --epr-hover-bg-color: hsl(var(--accent)) !important;
                  --epr-focus-bg-color: hsl(var(--accent)) !important;
                  --epr-highlight-color: hsl(var(--foreground)) !important;
                  --epr-category-label-text-color: hsl(var(--muted-foreground)) !important;
                  --epr-search-input-bg-color: hsl(var(--background)) !important;
                  --epr-search-input-text-color: hsl(var(--foreground)) !important;
                  --epr-search-input-placeholder-color: hsl(var(--muted-foreground)) !important;
                  --epr-category-icon-active-color: hsl(var(--foreground)) !important;
                  --epr-category-icon-inactive-color: hsl(var(--muted-foreground)) !important;
                }
                .emoji-picker-react .epr-body {
                   flex: 1 !important;
                   min-height: 0 !important;
                }
                /* Hide category nav if user wants no grouping? 
                   We keep it but make it minimal at bottom as Feishu 
                   Feishu actually has top tabs for types, and bottom for categories for Emoji 
                */
                .emoji-picker-react .epr-category-nav {
                   order: 2 !important;
                   padding-top: 4px !important;
                   padding-bottom: 4px !important;
                   border-top: 1px solid var(--border);
                }
                /* Style the internal search bar to match our custom one */
                .emoji-picker-react .epr-search-container {
                  display: none !important;
                  padding: 8px 12px !important;
                  background: transparent !important;
                }
                .emoji-picker-react .epr-search-container input.epr-search-input {
                  height: 32px !important;
                  border-radius: 6px !important;
                  border: 1px solid var(--input) !important;
                  background-color: transparent !important; 
                  font-size: 14px !important;
                  padding-left: 32px !important; /* Space for icon if we could inject one, default has one */
                }
                .emoji-picker-react .epr-preview {
                  display: none !important;
                }
                 .emoji-picker-react img.emoji {
                   width: 28px !important;
                   height: 28px !important;
                 }
                 /* Hide specific category labels if needed for "flat" look, 
                    but headers are useful. User said "no grouping" but 
                    maybe meant "collapsible" or "complex" grouping. 
                    Let's keep headers but simpler styles 
                 */
                 .emoji-picker-react .epr-category-label {
                   font-size: 12px !important;
                   color: var(--muted-foreground) !important;
                   padding: 4px 12px !important;
                   top: 0 !important;
                   backdrop-filter: blur(4px);
                 }
              `}</style>
               <div className="emoji-picker-react-wrapper h-full w-full">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      onChange(emojiData.emoji);
                      setOpen(false);
                    }}
                    width="100%"
                    height="100%"
                    searchDisabled
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                    theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
                    emojiStyle={EmojiStyle.APPLE}
                    categories={EMOJI_CATEGORIES}
                  />
               </div>
            </div>
          )}

          {tab === "icon" && (
             <ScrollArea className="h-full">
                <div className="p-3 grid grid-cols-6 gap-1">
                   {filteredIcons.map((iconName) => {
                     const Icon = (LucideIcons as any)[iconName];
                     return (
                       <Button
                         key={iconName}
                         type="button"
                         variant="ghost"
                         size="icon"
                         className={cn(
                           "aspect-square h-auto w-full rounded-md p-0 transition-all duration-150 hover:bg-muted",
                           value === iconName &&
                             "bg-accent text-accent-foreground shadow-sm",
                         )}
                         onClick={() => {
                           onChange(iconName);
                           setOpen(false);
                         }}
                         title={iconName}
                       >
                         <Icon className="h-6 w-6 stroke-[1.5]" />
                       </Button>
                     );
                   })}
                   {filteredIcons.length === 0 && (
                     <div className="col-span-6 text-center py-12 text-sm text-muted-foreground">
                       未找到匹配的图标
                     </div>
                   )}
                </div>
             </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
