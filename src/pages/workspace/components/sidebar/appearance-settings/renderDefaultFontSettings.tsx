import { DefaultFontSelect } from "../../shared/DefaultFontSelect";
import type { useAppearanceSettings } from "./useAppearanceSettings";

export function renderDefaultFontSettings(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const {
    customFonts,
    setCustomFont,
    editorFontSize,
    section,
    showPreview,
    editorLineHeight,
  } = context;
  return (
    <DefaultFontSelect
      id="appearance-default-font"
      value={customFonts.default.font}
      fontSize={editorFontSize}
      lineHeight={editorLineHeight}
      onChange={(font) => setCustomFont("default", font)}
      showPreview={section === "all"}
    />
  );
}
