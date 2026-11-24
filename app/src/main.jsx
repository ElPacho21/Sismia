import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// tipografías del design system Estratos, alojadas en el sitio: Alegreya (relato) e IBM Plex Mono (instrumento)
import "@fontsource-variable/alegreya/wght.css";
import "@fontsource-variable/alegreya/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./estilos.css";

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
