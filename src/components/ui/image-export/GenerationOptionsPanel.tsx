import * as GooseIcons from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { type WatermarkConfig } from "@/lib/imageExport";
import { cn } from "@/lib/utils";

export function GenerationOptionsPanel({
  wm,
  onToggle,
  variant,
}: {
  wm: WatermarkConfig;
  onToggle: (key: keyof WatermarkConfig) => void;
  variant: "toolbar" | "drawer";
}) {
  const rows: Array<{
    key: keyof WatermarkConfig;
    label: string;
    shortLabel?: string;
    disabled?: boolean;
    indent?: boolean;
  }> = [
    { key: "showTitle", label: "显示标题", shortLabel: "标题" },
    { key: "showWatermark", label: "显示底部信息栏", shortLabel: "底部栏" },
    { key: "showBrand", label: "显示品牌名", shortLabel: "品牌", disabled: !wm.showWatermark, indent: true },
    { key: "showDate", label: "显示日期", shortLabel: "日期", disabled: !wm.showWatermark, indent: true },
    {
      key: "showTime",
      label: "追加时分秒",
      shortLabel: "时分秒",
      disabled: !wm.showWatermark || !wm.showDate,
      indent: true,
    },
  ];

  if (variant === "toolbar") {
    return (
      <section
        aria-label="生成选项"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0 rounded-lg border bg-muted/20 px-3 py-2"
      >
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <GooseIcons.Settings className="h-3 w-3" />
          生成选项
        </span>
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center gap-2",
              row.disabled && "text-disabled",
            )}
          >
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {row.shortLabel ?? row.label}
            </span>
            <Switch
              checked={wm[row.key]}
              onCheckedChange={() => onToggle(row.key)}
              disabled={row.disabled}
              className="scale-75 origin-center"
            />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="生成选项" className="mt-3">
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center justify-between",
              row.indent && "pl-3",
            )}
          >
            <span
              className={cn(
                "text-xs",
                row.indent ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {row.label}
            </span>
            <Switch
              checked={wm[row.key]}
              onCheckedChange={() => onToggle(row.key)}
              disabled={row.disabled}
              className="scale-75 origin-right"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
