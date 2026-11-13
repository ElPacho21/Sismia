import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/instrument-sans";
import "./estilos.css";

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
