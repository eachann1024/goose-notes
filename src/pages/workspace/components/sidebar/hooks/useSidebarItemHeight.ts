import { computeSidebarRowHeight } from "@/lib/appearance";
import { useSettings } from "@/stores/useSettings";

export function useSidebarItemHeight() {
  const sidebarFontSize = useSettings((s) => s.sidebarFontSize);

  return useMemo(
    () => computeSidebarRowHeight(sidebarFontSize),
    [sidebarFontSize],
  );
}
