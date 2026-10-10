import {
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./tool-progress.css";

import type { WorkCardStatusData } from "./workCardStatusContext";

const STATUS_ICONS = {
  running: LoaderCircle,
  done: Check,
  error: CircleAlert,
  waiting: Clock3,
  cancelled: X,
  undone: RotateCcw,
};

export function WorkCardStatus({ status }: { status: WorkCardStatusData }) {
  const Icon = STATUS_ICONS[status.icon];
  return (
    <h3
      className={cn(
        "notebook-ai-work-status",
        `notebook-ai-work-status--${status.tone}`,
      )}
    >
      <Icon
        className={cn(
          "notebook-ai-work-status-icon",
          status.icon === "running" && "notebook-ai-work-status-spinner",
        )}
        aria-hidden
      />
      <span>{status.label}</span>
    </h3>
  );
}
