import { DEFAULT_FONT_NAMES } from "@/lib/fontLoader";
import { LocalFontInput } from "../../shared/LocalFontInput";
import type { useAppearanceSettings } from "./useAppearanceSettings";
import { defaultLabels } from "./shared";

export function renderAdditionalFontSettings(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const { customFonts, setCustomFont } = context;
  return (
    <div className="space-y-4">
      {(["serif", "mono"] as const).map((type) => (
        <div
          key={type}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 rounded-xl bg-[hsl(var(--goose-selected-bg)/0.4)] p-2"
        >
          <Label htmlFor={`appearance-${type}-font`}>
            {defaultLabels[type]}
          </Label>
          <div className="flex flex-1 items-center gap-2">
            <LocalFontInput
              id={`appearance-${type}-font`}
              label={`${defaultLabels[type]}字体名称`}
              value={customFonts[type].font || ""}
              onChange={(value) => setCustomFont(type, value || null)}
              placeholder={`默认：${DEFAULT_FONT_NAMES[type]}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
