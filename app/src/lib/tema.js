// Tema de la página: basalto (oscuro, el de siempre) o loess (claro), los dos temas del design system Sisimia Estratos.
// El CSS cambia con data-theme en <html>. Los gráficos se generan en basalto: con loess, cada color pasa a su par según
// la tabla tema_claro de paleta.json (sale de palette.py). El globo es el espacio y queda oscuro en los dos temas.
import { createContext, useContext } from "react";

const CLAVE = "sisimia-tema";
const FONDO = { basalto: "#16110d", loess: "#ece1cf" }; // suelo de cada tema, para la barra del navegador

// index.html ya puso el tema guardado antes de dibujar (así no parpadea): acá sólo se lo lee
export function temaInicial() {
  return document.documentElement.dataset.theme === "loess" ? "loess" : "basalto";
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === "loess") raiz.dataset.theme = "loess";
  else delete raiz.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", FONDO[tema]);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento (ventana privada, sitio bloqueado): el tema vale sólo para esta visita
  }
}

// { tema, claro }: claro es la tabla de basalto -> loess
export const TemaContexto = createContext({ tema: "basalto", claro: {} });
export const useTema = () => useContext(TemaContexto);

// el color de basalto en el tema actual
export function colorEnTema(color, { tema, claro }) {
  return tema === "loess" ? (claro[color?.toLowerCase()] ?? color) : color;
}

// una especificación de Vega con todos sus colores pasados al tema actual
export function specEnTema(spec, contexto) {
  if (contexto.tema !== "loess") return spec;
  const pasar = (v) => {
    if (typeof v === "string") return /^#[0-9a-f]{6}$/i.test(v) ? colorEnTema(v, contexto) : v;
    if (Array.isArray(v)) return v.map(pasar);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pasar(x)]));
    return v;
  };
  return pasar(spec);
}
