import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import "./index.css";
import "./fonts.css";
import App from "./App.tsx";
import { applyFontVariables, preloadFonts } from "./lib/fontLoader";
import { flushUToolsStorageWrites } from "./lib/storage";
import { UToolsAdapter } from "./lib/utools";
import { usePages } from "./stores/usePages";
import { useSettings } from "./stores/useSettings";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const settings = useSettings.getState();
let flushInFlight: Promise<void> | null = null;

const flushAllPendingWrites = async () => {
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true },
    }),
  );
  await usePages.getState().flushPendingLocalSaves();
  await flushUToolsStorageWrites();
};

const runFlushOnce = () => {
  if (flushInFlight) return flushInFlight;
  flushInFlight = flushAllPendingWrites().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
};

const setupSaveGuards = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const hostWindow = window as Window & { __gooseNoteSaveGuardInstalled?: boolean };
  if (hostWindow.__gooseNoteSaveGuardInstalled) return;
  hostWindow.__gooseNoteSaveGuardInstalled = true;

  const handleManualSave = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.isComposing || event.keyCode === 229) return;
    if (!event.metaKey && !event.ctrlKey) return;
    if (event.altKey || event.shiftKey || event.repeat) return;
    if (event.key.toLowerCase() !== "s") return;

    const target = document.activeElement;
    const isEditableInput =
      target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isEditableInput) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void runFlushOnce().then(() => {
      toast("内容会自动保存，请放心", { duration: 1500 });
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void runFlushOnce();
    }
  };

  const handlePageHide = () => {
    void runFlushOnce();
  };

  const handleBeforeUnload = () => {
    void runFlushOnce();
  };

  document.addEventListener("keydown", handleManualSave, { capture: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handleBeforeUnload);
};

const initHostFs = async () => {
  await UToolsAdapter.ensureGooseFs();
};

const bootstrap = async () => {
  await initHostFs();
  setupSaveGuards();
  applyFontVariables(settings.customFonts);
  preloadFonts();

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void bootstrap();
