import { AnimatePresence, motion } from "framer-motion";

export type TreeDragGuideDirection = "left" | "right" | "neutral";

interface SidebarDragGuideProps {
  visible: boolean;
  direction: TreeDragGuideDirection;
  isLocalFolder: boolean;
}

export function SidebarDragGuide({
  visible,
  direction,
  isLocalFolder,
}: SidebarDragGuideProps) {
  const leftActive = direction === "left";
  const rightActive = direction === "right";

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="overflow-hidden px-2"
        >
          <motion.div
            layout
            className="rounded-lg border border-primary/25 bg-primary/6 px-2.5 py-2"
          >
            <div className="mb-1.5 text-[11px] text-muted-foreground/75">
              拖拽提示：松开即可生效
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px] transition-all",
                  leftActive
                    ? "border-primary bg-primary/14 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : "border-border/60 bg-background text-muted-foreground",
                )}
              >
                <div className="font-medium">← 向左拖动</div>
                <div className="mt-0.5 opacity-80">
                  {isLocalFolder ? "回到上一级目录" : "回到上一级"}
                </div>
              </div>
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px] transition-all",
                  rightActive
                    ? "border-primary bg-primary/14 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : "border-border/60 bg-background text-muted-foreground",
                )}
              >
                <div className="font-medium">→ 向右拖动</div>
                <div className="mt-0.5 opacity-80">
                  {isLocalFolder ? "作为子级条目" : "作为子页面"}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
