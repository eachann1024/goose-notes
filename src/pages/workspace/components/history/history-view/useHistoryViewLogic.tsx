import { useHistoryViewState } from "./logic/useHistoryViewState";
import { useHistoryRestoreActions } from "./logic/useHistoryRestoreActions";

export function useHistoryViewLogic() {
  const history = useHistoryViewState();
  const historyRestoreActionsContext = useHistoryRestoreActions(history);
  const context = historyRestoreActionsContext;
  const {
    selectedVersionId,
    exit,
    select,
    pageId,
    page,
    pageTitle,
    indexError,
    selectedContent,
    selectedStatus,
    isRestoring,
    pendingMilestoneVersionId,
    groups,
    selectedEntry,
    handleRestore,
    handleToggleMilestone,
  } = context;

  return {
    pageId,
    page,
    pageTitle,
    groups,
    isEmpty: groups.length === 0,
    indexError,
    selectedVersionId,
    selectedEntry,
    selectedContent,
    selectedStatus,
    isRestoring,
    pendingMilestoneVersionId,
    exit,
    select,
    handleRestore,
    handleToggleMilestone,
  };
}
