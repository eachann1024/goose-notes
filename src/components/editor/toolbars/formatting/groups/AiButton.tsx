import * as LucideIcons from "lucide-react";
import { Tooltip, TooltipTrigger } from "@/components/editor/ui/tooltip";
import { Button } from "@/components/editor/ui/button";
import { ToolbarTooltip, type BindTooltip } from "../ToolbarTooltip";

export function AiButton({
  onActivate,
  bindTooltip,
}: {
  onActivate: () => void;
  bindTooltip: BindTooltip;
}) {
  return (
    <Tooltip {...bindTooltip("ai-polish")}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onActivate}
          aria-label="AI 润色"
          className="h-7 w-7 rounded-md p-0 text-primary hover:bg-muted hover:text-primary"
        >
          <LucideIcons.Sparkles className="h-[15px] w-[15px]" />
        </Button>
      </TooltipTrigger>
      <ToolbarTooltip label="AI 润色" />
    </Tooltip>
  );
}
