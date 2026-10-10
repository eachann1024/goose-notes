import { Dropdown, Header } from "@heroui/react";
import * as GooseIcons from "@/components/ui/icons";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/editor/ui/dropdown-menu";
import { editTableDimension, tableDimensionColor } from "./tableMenuActions";

interface GooseTableColorMenuProps {
  editor: any;
  blockId: string;
  orientation: "row" | "column";
  index: number;
  onAction: (action: () => void) => void;
}

export function GooseTableColorMenu({
  editor,
  blockId,
  orientation,
  index,
  onAction,
}: GooseTableColorMenuProps) {
  return (
    <Dropdown.SubmenuTrigger>
      <DropdownMenuItem textValue="颜色">
        <GooseIcons.Palette /> 颜色{" "}
        <GooseIcons.ChevronRight className="ml-auto" />
      </DropdownMenuItem>
      <DropdownMenuContent
        editorContext
        variant="menu"
        className="goose-table-menu goose-table-color-menu"
        side="right"
      >
        {(["textColor", "backgroundColor"] as const).map((property) => {
          const selectedColor = tableDimensionColor(
            editor.prosemirrorState,
            blockId,
            orientation,
            index,
            property,
          );
          return (
            <Dropdown.Section
              key={property}
              className="goose-table-color-group"
              aria-label={property === "textColor" ? "文字颜色" : "背景颜色"}
              selectionMode="single"
              selectedKeys={
                selectedColor ? [`${property}:${selectedColor}`] : []
              }
            >
              <Header className="goose-table-menu-heading px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
                {property === "textColor" ? "文字颜色" : "背景颜色"}
              </Header>
              {(
                [
                  ["default", "默认"],
                  ["gray", "灰色"],
                  ["brown", "褐色"],
                  ["green", "绿色"],
                  ["blue", "蓝色"],
                ] as const
              ).map(([color, label]) => (
                <DropdownMenuItem
                  key={color}
                  id={`${property}:${color}`}
                  className="goose-table-color-swatch"
                  aria-label={`${label}${property === "textColor" ? "文字" : "背景"}`}
                  textValue={`${label}${property === "textColor" ? "文字" : "背景"}`}
                  style={
                    {
                      "--goose-table-swatch-fg":
                        property === "textColor" && color !== "default"
                          ? `var(--goose-editor-highlight-${color}-text)`
                          : "hsl(var(--foreground))",
                      "--goose-table-swatch-bg":
                        property === "backgroundColor" && color !== "default"
                          ? `var(--goose-editor-highlight-${color}-bg)`
                          : "hsl(var(--background))",
                    } as React.CSSProperties
                  }
                  onSelect={() =>
                    onAction(() =>
                      editor.exec(
                        editTableDimension(blockId, orientation, index, {
                          type: "color",
                          property,
                          color,
                        }),
                      ),
                    )
                  }
                >
                  <span aria-hidden="true">A</span>
                </DropdownMenuItem>
              ))}
            </Dropdown.Section>
          );
        })}
      </DropdownMenuContent>
    </Dropdown.SubmenuTrigger>
  );
}
