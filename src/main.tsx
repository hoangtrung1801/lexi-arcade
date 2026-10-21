import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installFrames } from "./lib/frames";
import "./styles.css";

installFrames();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
