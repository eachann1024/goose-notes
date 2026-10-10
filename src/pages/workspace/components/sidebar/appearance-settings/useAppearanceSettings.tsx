import { useSettings } from "@/stores/useSettings";
import { type KeyboardEvent, type PointerEvent } from "react";
import { type SettingsAppearanceProps, accentOptions } from "./shared";

export function useAppearanceSettings({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  customFonts,
  setCustomFont,
  uiFontSize,
  setUIFontSize,
  editorFontSize,
  section = "all",
  showPreview = true,
}: SettingsAppearanceProps) {
  const appearanceLayoutRef = useRef<HTMLDivElement>(null);

  const scaleDragCleanupRef = useRef<(() => void) | null>(null);

  const [scaleDragLayout, setScaleDragLayout] = useState<
    "preview" | "options" | null
  >(null);

  const unlockScaleDragLayout = () => {
    scaleDragCleanupRef.current?.();
    scaleDragCleanupRef.current = null;
    setScaleDragLayout(null);
  };

  useEffect(() => () => scaleDragCleanupRef.current?.(), []);

  const lockScaleDragLayout = (event: PointerEvent<HTMLInputElement>) => {
    const preview = appearanceLayoutRef.current?.querySelector<HTMLElement>(
      '[aria-label="编辑器即时预览"]',
    );
    setScaleDragLayout(
      preview && getComputedStyle(preview).display !== "none"
        ? "preview"
        : "options",
    );
    const slider = event.currentTarget;
    const scrollContainer = slider.closest<HTMLElement>(
      ".settings-appearance-options",
    );
    const sliderTop = slider.getBoundingClientRect().top;
    scaleDragCleanupRef.current?.();
    let observer: MutationObserver | null = null;
    if (scrollContainer) {
      // 上方内容随字号重排时，让正在拖动的滑条保持在原来的屏幕位置。
      observer = new MutationObserver(() => {
        scrollContainer.scrollTop +=
          slider.getBoundingClientRect().top - sliderTop;
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
    // 原生 range 可能接管指针；在控件外松手或窗口失焦也要解除布局锁。
    window.addEventListener("pointerup", unlockScaleDragLayout);
    window.addEventListener("pointercancel", unlockScaleDragLayout);
    window.addEventListener("blur", unlockScaleDragLayout);
    scaleDragCleanupRef.current = () => {
      observer?.disconnect();
      window.removeEventListener("pointerup", unlockScaleDragLayout);
      window.removeEventListener("pointercancel", unlockScaleDragLayout);
      window.removeEventListener("blur", unlockScaleDragLayout);
    };
    slider.setPointerCapture(event.pointerId);
  };

  const editorLineHeight = useSettings((s) => s.editorLineHeight);

  const setEditorLineHeight = useSettings((s) => s.setEditorLineHeight);

  const setEditorFontSize = useSettings((s) => s.setEditorFontSize);

  const uiFontFamily = useSettings((s) => s.uiFontFamily);

  const sidebarFontFamily = useSettings((s) => s.sidebarFontFamily);

  const setUIFontFamily = useSettings((s) => s.setUIFontFamily);

  const setSidebarFontFamily = useSettings((s) => s.setSidebarFontFamily);

  const accentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [focusedAccentIndex, setFocusedAccentIndex] = useState(() =>
    Math.max(
      0,
      accentOptions.findIndex((option) => option.value === accentColor),
    ),
  );

  const focusAccentOption = (index: number) => {
    const nextIndex = (index + accentOptions.length) % accentOptions.length;
    setFocusedAccentIndex(nextIndex);
    accentRefs.current[nextIndex]?.focus();
  };

  const handleAccentKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusAccentOption(index + 1);
      setAccentColor(accentOptions[(index + 1) % accentOptions.length].value);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAccentOption(index - 1);
      setAccentColor(
        accentOptions[(index - 1 + accentOptions.length) % accentOptions.length]
          .value,
      );
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusAccentOption(0);
      setAccentColor(accentOptions[0].value);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusAccentOption(accentOptions.length - 1);
      setAccentColor(accentOptions[accentOptions.length - 1].value);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setAccentColor(accentOptions[index].value);
    }
  };
  return {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    customFonts,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
    editorFontSize,
    section,
    showPreview,
    appearanceLayoutRef,
    scaleDragCleanupRef,
    scaleDragLayout,
    setScaleDragLayout,
    unlockScaleDragLayout,
    lockScaleDragLayout,
    editorLineHeight,
    setEditorLineHeight,
    setEditorFontSize,
    uiFontFamily,
    sidebarFontFamily,
    setUIFontFamily,
    setSidebarFontFamily,
    accentRefs,
    focusedAccentIndex,
    setFocusedAccentIndex,
    focusAccentOption,
    handleAccentKeyDown,
  };
}
