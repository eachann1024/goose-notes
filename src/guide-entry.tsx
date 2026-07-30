import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GuideApp } from "./pages/guide/GuideApp";
import "./pages/guide/guide.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GuideApp />
  </StrictMode>,
);
