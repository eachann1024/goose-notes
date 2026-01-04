import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./fonts.css";
import App from "./App.tsx";
import { applyFontVariables, preloadFonts } from "./lib/fontLoader";
import { useSettings } from "./stores/useSettings";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const settings = useSettings.getState();

applyFontVariables(settings.customFonts);
preloadFonts();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
