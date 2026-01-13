import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { useEffect, useRef } from "react";

interface IconSelectorProps<T extends HTMLElement = HTMLElement> {
  value?: string;
  onChange: (icon: string | undefined) => void;
  children: React.ReactNode;
  portalContainerRef?: React.RefObject<T | null>;
  onFirstOpen?: () => void;
}

// 常用图标白名单（移除不常用的图标）
const COMMON_ICONS = [
  // 基础
  "FileText", "Folder", "FolderOpen", "Home", "Settings", "Search", "Menu", "X", "Check",
  // 箭头
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ChevronDown", "ChevronUp", "ChevronLeft", "ChevronRight",
  // 操作
  "Plus", "Minus", "Edit", "Trash2", "Copy", "Move", "RefreshCw", "RotateCcw",
  "Undo", "Redo", "ZoomIn", "ZoomOut", "Maximize", "Minimize",
  // 媒体
  "Play", "Pause", "Stop", "SkipBack", "SkipForward", "Volume2", "VolumeX", "Mute",
  "Image", "Video", "Mic", "MicOff", "Camera", "CameraOff",
  // 通信
  "Mail", "Send", "MessageSquare", "MessageCircle", "Phone", "PhoneCall", "PhoneIncoming", "PhoneOutgoing",
  "Bell", "BellOff", "AtSign", "Hash",
  // 用户
  "User", "Users", "UserPlus", "UserMinus", "UserCheck", "UserX", "Shield", "ShieldCheck", "ShieldAlert",
  // 时间
  "Calendar", "Clock", "Timer", "AlarmClock", "Hourglass",
  // 标记
  "Star", "StarHalf", "Heart", "Bookmark", "BookmarkCheck", "BookmarkX", "Flag", "FlagCheckered", "FlagOff",
  "Tag", "Tags", "Badge", "Award", "Trophy", "Medal",
  // 工具
  "Wrench", "Hammer", "Screwdriver", "Tool", "Settings2", "MoreHorizontal", "MoreVertical",
  "Filter", "Sliders", "Tune", "Equal", "PlusCircle", "MinusCircle",
  // 文档
  "File", "FileCode", "FileSpreadsheet", "FileImage", "FileVideo", "FileAudio", "FileArchive", "FileCheck",
  "Clipboard", "ClipboardCopy", "ClipboardCheck", "ClipboardX", "List", "ListTodo", "ListChecks",
  // 导航
  "Layout", "LayoutDashboard", "LayoutGrid", "LayoutList", "Sidebar", "PanelLeft", "PanelRight", "PanelTop", "PanelBottom",
  "Tabs", "AppWindow", "Layers", "Grid",
  // 云/同步
  "Cloud", "CloudDownload", "CloudUpload", "CloudOff", "Database", "Server", "HardDrive", "Download", "Upload",
  "Sync", "RefreshCw", "Loader", "Loader2",
  // 安全
  "Lock", "Unlock", "Key", "Eye", "EyeOff", "Fingerprint", "ShieldAlert",
  // 状态
  "AlertCircle", "AlertTriangle", "AlertOctagon", "Info", "HelpCircle", "HelpCircle", "CheckCircle", "XCircle",
  "Circle", "CircleDot", "Fingerprint", "Zap", "ZapOff", "Flame", "Sparkles",
  // 编辑器
  "Bold", "Italic", "Underline", "Strikethrough", "Code", "Heading1", "Heading2", "Heading3",
  "List", "ListOrdered", "Quote", "AlignLeft", "AlignCenter", "AlignRight", "AlignJustify", "Indent", "Outdent",
  "Link", "Link2", "Unlink", "Highlight", "Palette",
  // 图表
  "BarChart", "BarChart2", "BarChart3", "BarChart4", "PieChart", "LineChart", "TrendingUp", "TrendingDown", "Activity",
  // 位置
  "MapPin", "Map", "Compass", "Navigation", "Navigation2", "Globe", "Locate", "LocateFixed", "Crosshair",
  // 其他
  "Sun", "Moon", "CloudSun", "CloudMoon", "CloudRain", "CloudSnow", "CloudLightning", "CloudDrizzle",
  "Thermometer", "Droplet", "Wind", "Snowflake", "Fire", "Flame",
  "Lightbulb", "LightbulbOff", "Candle", "Cigarette", "Plug", "PlugZap", "Power", "PowerOff",
  "Coffee", "Pizza", "Cake", "Cookie", "Apple", "Cherry", "Grape", "Lemon", "Citrus",
  "Book", "BookOpen", "Bookmark", "Library", "GraduationCap", "PenTool", "Pencil", "Eraser",
  "Calculator", "Ruler", "Pen", "Highlighter",
];

const AVAILABLE_ICONS = Array.from(new Set(COMMON_ICONS));

export function IconSelector<T extends HTMLElement = HTMLElement>({
  value,
  onChange,
  children,
  portalContainerRef,
  onFirstOpen,
}: IconSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"emoji" | "icon">("emoji");
  const portalContainer = portalContainerRef?.current ?? undefined;
  const hasOpenedRef = useRef(false);

  const filteredIcons = useMemo(() => {
    const icons = AVAILABLE_ICONS.filter((key) => {
      if (!LucideIcons || !(key in (LucideIcons as any))) return false;
      return !search || key.toLowerCase().includes(search.toLowerCase());
    });
    return icons.slice(0, 144); // 最多显示 144 个（12x12 网格）
  }, [search]);

  // 第一次打开时触发 onFirstOpen 回调
  useEffect(() => {
    if (open && !hasOpenedRef.current && onFirstOpen) {
      hasOpenedRef.current = true;
      onFirstOpen();
    }
  }, [open, onFirstOpen]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0 rounded-2xl"
        align="start"
        side="right"
        collisionPadding={10}
        container={portalContainer}
        data-side="right"
      >
        <div className="flex border-b rounded-t-2xl">
          <button
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${tab === "emoji" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("emoji")}
          >
            表情符号
          </button>
          <button
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${tab === "icon" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("icon")}
          >
            图标
          </button>
          <button
            className="px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200 flex items-center gap-1 rounded-t-2xl font-semibold"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            title="移除图标"
          >
            <LucideIcons.X className="h-4 w-4" />
            <span>移除</span>
          </button>
        </div>

        <div className="h-[320px]">
          {tab === "emoji" ? (
            <div
              key="emoji"
              className="w-full h-full animate-in fade-in duration-150 relative"
            >
              <style>{`
                .emoji-picker-react-wrapper .emoji-picker-react {
                  margin-top: -8px !important;
                }
                .emoji-picker-react {
                  --ep-size: 28px;
                  --category-font-size: 0;
                  padding-top: 0 !important;
                }
                .emoji-picker-react > div:first-child {
                  padding-top: 0 !important;
                  margin-top: 0 !important;
                }
                .emoji-picker-react .category-label {
                  display: none !important;
                }
                .emoji-picker-react .emoji {
                  transition: transform 150ms ease;
                  cursor: pointer;
                }
                .emoji-picker-react .emoji:hover {
                  transform: scale(1.3);
                }
                .emoji-picker-react .emoji-search,
                .emoji-picker-react .search-container {
                  display: none !important;
                }
                .emoji-picker-react .preview-pane {
                  display: none !important;
                }
                .emoji-picker-react [class*="header"] {
                  display: none !important;
                }
              `}</style>
              <div className="emoji-picker-react-wrapper absolute inset-0 -ml-3">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    onChange(emojiData.emoji);
                    setOpen(false);
                  }}
                  width="100%"
                  height="100%"
                  searchDisabled={true}
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  theme={Theme.AUTO}
                  emojiStyle={EmojiStyle.APPLE}
                />
              </div>
            </div>
          ) : (
            <div
              key="icon"
              className="flex flex-col h-full animate-in fade-in duration-150"
            >
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
                <div className="p-2 grid grid-cols-8 gap-1">
                  {filteredIcons.map((iconName) => {
                    const Icon = (LucideIcons as any)[iconName];
                    return (
                      <button
                        key={iconName}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-all duration-150 hover:scale-105 active:scale-95",
                          value === iconName &&
                            "bg-accent text-accent-foreground",
                        )}
                        onClick={() => {
                          onChange(iconName);
                          setOpen(false);
                        }}
                        title={iconName}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                  {filteredIcons.length === 0 && (
                    <div className="col-span-8 text-center py-8 text-sm text-muted-foreground">
                      未找到匹配的图标
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
