import { useEffect, useRef, useState } from "react";
import { LOCALE_VEGA } from "../lib/formato.js";

// Dibuja una especificación Vega-Lite (generada por Altair en build_app.py) con vega-embed.
// vega-embed se carga recién cuando hace falta: el resto de la página abre sin esperarlo.
//
// Si se le pasan `senales` ({ nombre_del_parametro: valor }), el gráfico queda sincronizado con la
// aplicación: aplica esos valores a los parámetros de Altair y avisa (alCambiarSenal) cuando el usuario los mueve.
export default function Grafico({ url, descripcion, senales, alCambiarSenal }) {
  const contenedor = useRef(null);
  const vistaRef = useRef(null);
  const senalesRef = useRef(senales);
  const avisoRef = useRef(alCambiarSenal);
  senalesRef.current = senales;
  avisoRef.current = alCambiarSenal;
  const [error, setError] = useState(null);

  useEffect(() => {
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
        const resultado = await embed(contenedor.current, spec, { actions: false, formatLocale: LOCALE_VEGA, renderer: "canvas" });
        const vista = resultado.view;
        if (cancelado) return vista.finalize();
        vistaRef.current = vista;
        for (const [nombre, valor] of Object.entries(senalesRef.current ?? {})) {
          vista.signal(nombre, valor);
          vista.addSignalListener(nombre, (_, v) => avisoRef.current?.(nombre, v));
        }
        await vista.runAsync();
      } catch (e) {
        if (!cancelado) setError(e.message);
      }
    })();
    return () => {
      cancelado = true;
      vistaRef.current?.finalize();
      vistaRef.current = null;
    };
  }, [url]);

  // cuando la aplicación cambia un valor (por ejemplo desde el globo), se lo pasa al gráfico
  useEffect(() => {
    const vista = vistaRef.current;
    if (!vista || !senales) return;
    let cambio = false;
    for (const [nombre, valor] of Object.entries(senales)) {
      if (vista.signal(nombre) !== valor) {
        vista.signal(nombre, valor);
        cambio = true;
      }
    }
    if (cambio) vista.runAsync();
  }, [senales]);

  return (
    <figure className="grafico" aria-label={descripcion}>
      <div ref={contenedor} />
      {error && <p className="error">No se pudo dibujar el gráfico: {error}</p>}
    </figure>
  );
}
