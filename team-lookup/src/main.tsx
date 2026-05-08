import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const mountNode: HTMLElement | null = document.getElementById("root");
if (mountNode == null) {
  throw new Error("Root element #root not found");
}
createRoot(mountNode).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
