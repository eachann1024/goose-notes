import { useEffect, useState } from "react";
import { AI_PANEL_ACTIVE_ATTR, readAiPanelActive } from "@/components/editor/ai/composer/selectionQuote";

/** 订阅 body 上的 AI 面板开闭标记，避免再调 useNotebookAiPanel。 */
export function useAiPanelActive(): boolean {
  const [active, setActive] = useState(readAiPanelActive);
  useEffect(() => {
    const sync = () => setActive(readAiPanelActive(document.body));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [AI_PANEL_ACTIVE_ATTR],
    });
    return () => observer.disconnect();
  }, []);
  return active;
}
