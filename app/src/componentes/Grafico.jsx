import { useEffect, useRef, useState } from "react";
import { LOCALE_VEGA } from "../lib/formato.js";

// Dibuja una especificación Vega-Lite (generada por Altair en build_app.py) con vega-embed.
// vega-embed se carga recién cuando hace falta: el resto de la página abre sin esperarlo.
export default function Grafico({ url, descripcion }) {
  const contenedor = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vista = null;
    let cancelado = false;
    (async () => {
      try {
        const [{ default: embed }, spec] = await Promise.all([
          import("vega-embed"),
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${url}: ${r.status}`);
            return r.json();
          }),
        ]);
        if (cancelado) return;
        const resultado = await embed(contenedor.current, spec, {
          actions: false,
          formatLocale: LOCALE_VEGA,
          renderer: "canvas",
        });
        vista = resultado.view;
        if (cancelado) vista.finalize();
      } catch (e) {
        if (!cancelado) setError(e.message);
      }
    })();
    return () => {
      cancelado = true;
      if (vista) vista.finalize();
    };
  }, [url]);

  return (
    <figure className="grafico" aria-label={descripcion}>
      <div ref={contenedor} />
      {error && <p className="error">No se pudo dibujar el gráfico: {error}</p>}
    </figure>
  );
}
