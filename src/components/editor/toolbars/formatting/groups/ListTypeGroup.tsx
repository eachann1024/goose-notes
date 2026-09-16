import { CheckSquare, List, ListOrdered } from "lucide-react";
import { useBlockNoteEditor, useEditorState } from "@blocknote/react";
import { Tooltip, TooltipTrigger } from "@/components/editor/ui/tooltip";
import { Toggle } from "@/components/editor/ui/toggle";
import { ToolbarTooltip, type BindTooltip } from "../ToolbarTooltip";
import {
  applySelectedListType,
  getListTypeToolbarState,
  type ListBlockType,
} from "../listType";

const ITEM_CLASS = "goose-formatting-toolbar-control";

const LIST_TYPE_ITEMS: {
  type: ListBlockType;
  label: string;
  icon: typeof List;
}[] = [
  { type: "checkListItem", label: "提醒事项", icon: CheckSquare },
  { type: "bulletListItem", label: "无序列表", icon: List },
  { type: "numberedListItem", label: "有序列表", icon: ListOrdered },
];

export function ListTypeGroup({ bindTooltip }: { bindTooltip: BindTooltip }) {
  const editor = useBlockNoteEditor();
  const active = useEditorState({
    editor,
    selector: ({ editor }) => getListTypeToolbarState(editor).active,
  });

  return (
    <>
      {LIST_TYPE_ITEMS.map(({ type, label, icon: Icon }) => (
        <Tooltip key={type} {...bindTooltip(`list-${type}`)}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={active === type}
              onPressedChange={() => applySelectedListType(editor, type)}
              aria-label={label}
              className={ITEM_CLASS}
            >
              <Icon className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <ToolbarTooltip label={label} />
        </Tooltip>
      ))}
    </>
  );
}
