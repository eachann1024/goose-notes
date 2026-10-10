import {
  createContext,
  useContext,
  useLayoutEffect,
  type Dispatch,
  type SetStateAction,
} from "react";

export type WorkCardStatusData = {
  label: string;
  tone: "accent" | "success" | "danger" | "warning" | "neutral";
  icon: "running" | "done" | "error" | "waiting" | "cancelled" | "undone";
};

// 内嵌审批卡将提交、撤回等局部状态同步给唯一的外层抬头。
export const WorkCardStatusContext = createContext<Dispatch<
  SetStateAction<WorkCardStatusData | null>
> | null>(null);

export function useEmbeddedWorkCardStatus(
  status: WorkCardStatusData,
  embedded: boolean,
) {
  const reportStatus = useContext(WorkCardStatusContext);
  const { label, tone, icon } = status;
  useLayoutEffect(() => {
    if (!embedded || !reportStatus) return;
    reportStatus({ label, tone, icon });
    return () => reportStatus(null);
  }, [embedded, reportStatus, label, tone, icon]);
}
