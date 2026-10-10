import { create } from "zustand";
import type { TabsState } from "./tabs/types";
import { createTabsActionContext } from "./tabs/context";
import { loadPersistedTabs, startTabsPersistence } from "./tabs/persistence";
import { createActivationTabActions } from "./tabs/activationActions";
import { createOpeningTabActions } from "./tabs/openingActions";
import { createSpecialTabActions } from "./tabs/specialActions";
import { createClosingTabActions } from "./tabs/closingActions";
import { createHistoryTabActions } from "./tabs/historyActions";
import { createTransferTabActions } from "./tabs/transferActions";
import { createMaintenanceTabActions } from "./tabs/maintenanceActions";
import { createDeletedTabActions } from "./tabs/deletedActions";

export {
  WELCOME_TAB_PAGE_ID,
  NOTEBOOK_AI_TAB_PAGE_ID_PREFIX,
  getNotebookAiTabPageId,
  isNotebookAiTab,
  isSpecialTab,
} from "./tabs/types";
export type { TabType, TabItem } from "./tabs/types";

export const useTabs = create<TabsState>()((set, get) => {
  const context = createTabsActionContext(set, get);
  const persisted = loadPersistedTabs();
  return {
    openTabs: persisted?.openTabs ?? [],
    activeTabId: persisted?.activeTabId ?? null,
    tabHistory: [],
    tabHistoryIndex: -1,
    isHistoryNavigating: false,
    recentlyClosedPageIds: persisted?.recentlyClosedPageIds ?? [],
    ...createActivationTabActions(set, get, context),
    ...createOpeningTabActions(set, get, context),
    ...createSpecialTabActions(set, get, context),
    ...createClosingTabActions(set, get, context),
    ...createHistoryTabActions(set, get, context),
    ...createTransferTabActions(set, get, context),
    ...createMaintenanceTabActions(set, get, context),
    ...createDeletedTabActions(set, get, context),
  };
});

startTabsPersistence(useTabs);
