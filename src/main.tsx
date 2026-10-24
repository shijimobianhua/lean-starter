import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";
import "./sixth.css";
import "./eighth.css";
import "./v150.css";
import "./v152.css";
import "./v155.css";
import "./v156.css";
import "./v165.css";
import "./v166.css";
import {startInstallCapture} from "./install";
startInstallCapture();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
