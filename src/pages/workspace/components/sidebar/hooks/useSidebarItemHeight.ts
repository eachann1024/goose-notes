import { computeSidebarFontSize, computeSidebarRowHeight } from "@/lib/appearance";
import { useSettings } from "@/stores/useSettings";

export function useSidebarItemHeight() {
  const uiFontSize = useSettings((s) => s.uiFontSize);

  return useMemo(
    () => computeSidebarRowHeight(computeSidebarFontSize(uiFontSize)),
    [uiFontSize],
  );
}
