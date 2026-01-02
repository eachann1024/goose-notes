interface CommandListProps {
  items: any[];
  command: any;
  editor: any;
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    },
    [props],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedEl = container.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + props.items.length) % props.items.length,
          );
          return true;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % props.items.length);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }),
    [props.items.length, selectItem, selectedIndex],
  );

  if (props.items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="z-50 w-[240px] flex flex-col gap-1.5 p-1 rounded-xl border border-[#303030]/50 bg-[#1F1F1F] shadow-2xl transition-all animate-in fade-in zoom-in-95"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
    >
      <div className="text-[10px] font-medium text-[#7A7A7A] px-2 py-1 select-none">
        基本区块
      </div>

      <div className="flex flex-col gap-[1px] max-h-[260px] overflow-y-auto scrollbar-hide">
        {props.items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              data-index={index}
              className={cn(
                "relative flex cursor-pointer items-center rounded-[3px] px-2 py-1 min-h-[28px] text-sm outline-none w-full text-left transition-colors",
                index === selectedIndex
                  ? "bg-[#2C2C2C]"
                  : "hover:bg-[#2C2C2C]/50",
              )}
              onClick={() => selectItem(index)}
            >
              <div className="flex items-center justify-center w-5 h-5 shrink-0 mr-2 overflow-hidden rounded-[3px] bg-transparent">
                {item.title === "文本" || item.title === "Text" ? (
                  <span
                    className={cn(
                      "text-[15px] font-serif opacity-90 leading-none",
                      index === selectedIndex ? "text-white" : "text-[#CFCFCF]",
                    )}
                  >
                    T
                  </span>
                ) : (
                  <Icon
                    className={cn(
                      "h-[14px] w-[14px] stroke-[1.5]",
                      index === selectedIndex ? "text-white" : "text-[#CFCFCF]",
                    )}
                  />
                )}
              </div>

              <div className="flex flex-col flex-1 overflow-hidden">
                <span
                  className={cn(
                    "font-medium truncate text-[12px]",
                    index === selectedIndex ? "text-white" : "text-[#CFCFCF]",
                  )}
                >
                  {item.title}
                </span>
              </div>

              {item.shortcut && (
                <div className="text-[9px] opacity-30 font-mono ml-1.5 min-w-[12px] text-right text-[#CFCFCF]">
                  {item.shortcut}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-1 pt-1 border-t border-[#303030]/30">
        <div className="bg-[#2F2F2F] w-fit rounded-md text-[10px] text-[#CFCFCF] px-1.5 py-0.5 flex items-center gap-1">
          <span className="opacity-70">/筛选...</span>
        </div>
      </div>
    </div>
  );
});
