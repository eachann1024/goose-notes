import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
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
  { id: "emoji", label: "表情符号" },
  { id: "icon", label: "图标" },
] as const;

export function IconSelector<T extends HTMLElement = HTMLElement>({
  value,
  onChange,
  children,
  portalContainerRef,
  onFirstOpen,
  emojiOnly = false,
}: IconSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const portalContainer = portalContainerRef?.current ?? undefined;
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (emojiOnly) setTab("emoji");
  }, [emojiOnly]);

  const filteredIcons = useMemo(() => {
    const icons = AVAILABLE_ICONS.filter((key) => {
      if (!LucideIcons || !(key in (LucideIcons as any))) return false;
      return !search || key.toLowerCase().includes(search.toLowerCase());
    });
    return icons.slice(0, 200); 
  }, [search]);

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
        className="w-[380px] p-0 rounded-xl shadow-xl overflow-hidden"
        align="start"
        side="bottom"
        collisionPadding={10}
        container={portalContainer}
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-3 pt-2 text-[14px] border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex gap-4">
            {!emojiOnly &&
              NOTION_TABS.map((t) => (
                <button
                  key={t.id}
                  className={cn(
                    "pb-2 border-b-2 transition-colors px-0.5",
                    tab === t.id
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab(t.id as any)}
                >
                  {t.label}
                </button>
              ))}
              {emojiOnly && (
                 <div className="pb-2 border-b-2 border-foreground font-medium text-foreground px-0.5">
                   表情符号
                 </div>
              )}
          </div>
          <div className="flex items-center gap-1">
             <button 
                className="pb-2 text-muted-foreground hover:text-foreground transition-colors mr-2"
                title="随机图标"
                onClick={handleRandomIcon}
             >
                <LucideIcons.Shuffle className="h-4 w-4" />
             </button>
             <button
               className="pb-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
               onClick={() => {
                 onChange(undefined);
                 setOpen(false);
               }}
             >
               移除
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="h-[360px]">
          {tab === "emoji" && (
            <div className="h-full w-full">
              <style>{`
                .emoji-picker-react-wrapper {
                   --epr-search-input-height: 0px !important;
                   --epr-category-navigation-button-size: 28px !important;
                }
                .emoji-picker-react {
                  width: 100% !important;
                  height: 100% !important;
                  border: none !important;
                  background: transparent !important;
                  display: flex !important;
                  flex-direction: column !important;
                }
                .emoji-picker-react .epr-body {
                   flex: 1 !important;
                   min-height: 0 !important;
                }
                .emoji-picker-react .epr-category-nav {
                   order: 2 !important;
                   padding-top: 0 !important;
                   padding-bottom: 8px !important;
                }
                .emoji-picker-react .epr-search-container {
                  display: none !important;
                }
                .emoji-picker-react .epr-preview {
                  display: none !important;
                }
                /* Use CSS to make icons larger to match Notion */
                 .emoji-picker-react img.emoji {
                   width: 28px !important;
                   height: 28px !important;
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
                    theme={Theme.AUTO}
                    emojiStyle={EmojiStyle.APPLE}
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
                       <button
                         key={iconName}
                         className={cn(
                           "flex aspect-square w-full items-center justify-center rounded-md hover:bg-muted transition-all duration-150",
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
                       </button>
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
