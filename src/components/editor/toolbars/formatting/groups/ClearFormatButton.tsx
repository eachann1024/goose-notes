import * as GooseIcons from "@/components/ui/icons";
import { Tooltip, TooltipTrigger } from "@/components/editor/ui/tooltip";
import { Button } from "@/components/editor/ui/button";
import { ToolbarTooltip, type BindTooltip } from "../ToolbarTooltip";

export function ClearFormatButton({
  onClear,
  bindTooltip,
}: {
  onClear: () => void;
  bindTooltip: BindTooltip;
}) {
  return (
    <Tooltip {...bindTooltip("clear")}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="清除格式"
          className="goose-formatting-toolbar-control"
        >
          <GooseIcons.Eraser className="h-[15px] w-[15px]" />
        </Button>
      </TooltipTrigger>
      <ToolbarTooltip label="清除格式" />
    </Tooltip>
  );
}
