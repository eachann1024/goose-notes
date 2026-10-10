import type { TabSet, TabGet } from "./types";
import { createTabHistoryContext } from "./historyContext";
import { createTabReplacementContext } from "./replacementContext";

export function createTabsActionContext(set: TabSet, get: TabGet) {
  const history = createTabHistoryContext(set, get);
  const replacement = createTabReplacementContext(
    set,
    get,
    history.pushTabHistory,
  );
  return { ...history, ...replacement };
}

export type TabsActionContext = ReturnType<typeof createTabsActionContext>;
