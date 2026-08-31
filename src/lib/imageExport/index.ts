// Public API — re-export everything consumers need
export type { CardTheme, CardThemeId, NotebookCardThemeContext } from "./themes";
export {
  CARD_THEMES,
  getCardTheme,
  normalizeCardThemeId,
  resolveCardTheme,
  buildNotebookCardTheme,
  NOTEBOOK_THEME,
} from "./themes";
export type { WatermarkConfig } from "./watermark";
export { DEFAULT_WATERMARK_CONFIG, normalizeWatermarkConfig } from "./watermark";
export { exportPageToImage, exportSelectionToImage, exportToImage } from "./renderer";
export {
  IMAGE_EXPORT_LIVE_PREVIEW_MIN_WIDTH,
  IMAGE_EXPORT_OPTIONS_CORNER_MIN_WIDTH,
  shouldShowImageExportLivePreview,
  shouldShowImageExportOptionsCorner,
} from "./livePreview";
