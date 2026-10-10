import { Label } from "@/components/ui/label";
import {
  DEFAULT_FONT_NAMES,
  getEditorFontFamilies,
  toCssFontFamily,
} from "@/lib/fontLoader";
import { LocalFontSelect } from "../../shared/LocalFontSelect";
import type { useAppearanceSettings } from "./useAppearanceSettings";
import { defaultLabels } from "./shared";

export function renderAdditionalFontSettings(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const { customFonts, setCustomFont } = context;
  return (
    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      {(["serif", "mono"] as const).map((type) => (
        <div key={type} className="flex min-w-0 flex-col gap-3">
          <Label htmlFor={`appearance-${type}-font`}>
            {defaultLabels[type]}
          </Label>
          <LocalFontSelect
            id={`appearance-${type}-font`}
            label={`${defaultLabels[type]}字体`}
            value={customFonts[type].font || null}
            onChange={(value) => setCustomFont(type, value)}
            defaultLabel={`默认：${DEFAULT_FONT_NAMES[type]}`}
            defaultFontFamily={getEditorFontFamilies(type, {
              ...customFonts,
              [type]: { label: null, font: null },
            })
              .map(toCssFontFamily)
              .join(", ")}
          />
        </div>
      ))}
    </div>
  );
}
