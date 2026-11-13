import { useEffect, useRef, useState } from "react";
import { LOCALE_VEGA } from "../lib/formato.js";

// Las cajas que ocupan las leyendas y los ejes en el lienzo, recorriendo el árbol de dibujo de Vega
// (cada grupo suma su desplazamiento a lo que tiene adentro). Los ejes marcan hasta dónde llegan los gráficos.
function cajas(vista) {
  const resultado = {};
  const sumar = (rol, b, dx, dy) => {
    const c = (resultado[rol] ??= { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
    c.x1 = Math.min(c.x1, b.x1 + dx);
    c.y1 = Math.min(c.y1, b.y1 + dy);
    c.x2 = Math.max(c.x2, b.x2 + dx);
    c.y2 = Math.max(c.y2, b.y2 + dy);
  };
  const recorrer = (marca, dx, dy) => {
    for (const item of marca.items ?? []) {
      if ((marca.role === "legend" || marca.role === "axis") && item.bounds) sumar(marca.role, item.bounds, dx, dy);
      else if (marca.marktype === "group") for (const hija of item.items ?? []) recorrer(hija, dx + (item.x ?? 0), dy + (item.y ?? 0));
    }
  };
  // el origen de la vista (el lugar que Vega deja para los ejes) desplaza todo el dibujo
  const [ox, oy] = vista.origin();
  recorrer(vista.scenegraph().root, ox, oy);
  return resultado;
}

// Dónde van los controles al costado: debajo de las leyendas, si el gráfico entra sin deslizarse y queda ancho suficiente.
const ANCHO_MINIMO = 230;
function lugarAlLado(figura, vista) {
  const lienzo = figura.querySelector("canvas");
  if (!vista || !lienzo || figura.scrollWidth - figura.clientWidth > 4) return null;
  const { legend: caja, axis: ejes } = cajas(vista);
  if (!caja) return null;
  // dónde está el lienzo dentro de la tarjeta (vega-embed lo envuelve en su propio contenedor posicionado)
  const rl = lienzo.getBoundingClientRect();
  const rf = figura.getBoundingClientRect();
  const x0 = rl.left - rf.left - figura.clientLeft + figura.scrollLeft;
  const y0 = rl.top - rf.top - figura.clientTop + figura.scrollTop;
  // a la altura de las leyendas, pero siempre con aire a la derecha de los gráficos (incluidas las etiquetas de sus ejes)
  const left = x0 + Math.max(caja.x1, (ejes?.x2 ?? -Infinity) + 28);
  const width = figura.clientWidth - left - 16;
  if (width < ANCHO_MINIMO) return null;
  return { left, top: y0 + caja.y2 + 28, width };
}

// Dibuja una especificación Vega-Lite (generada por Altair en build_app.py) con vega-embed.
// vega-embed se carga recién cuando hace falta: el resto de la página abre sin esperarlo.
//
// Si se le pasan `senales` ({ nombre_del_parametro: valor }), el gráfico queda sincronizado con la
// aplicación: aplica esos valores a los parámetros de Altair y avisa (alCambiarSenal) cuando el usuario los mueve.
//
// Con `controles`, los controles de Altair se dibujan en un bloque propio con el título «Filtros»: si hay lugar,
// a la derecha del gráfico, debajo de las leyendas (al lado del mapa); si no, arriba del gráfico.
export default function Grafico({ url, descripcion, senales, alCambiarSenal, controles = false }) {
  const contenedor = useRef(null);
  const enlaces = useRef(null);
  const [alLado, setAlLado] = useState(null);
  const vistaRef = useRef(null);
  const senalesRef = useRef(senales);
  const avisoRef = useRef(alCambiarSenal);
  senalesRef.current = senales;
  avisoRef.current = alCambiarSenal;
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const figura = useRef(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [{ default: embed }, , spec] = await Promise.all([
          import("vega-embed"),
          // el lienzo no espera a las fuentes: se las pide antes de dibujar
          document.fonts?.load("12px 'Instrument Sans Variable'").catch(() => null),
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${url}: ${r.status}`);
            return r.json();
          }),
        ]);
        if (cancelado) return;
        const opciones = { actions: false, formatLocale: LOCALE_VEGA, renderer: "canvas", tooltip: { theme: "dark" } };
        if (controles && enlaces.current) opciones.bind = enlaces.current;
        const resultado = await embed(contenedor.current, spec, opciones);
        const vista = resultado.view;
        if (cancelado) return vista.finalize();
        vistaRef.current = vista;
        for (const [nombre, valor] of Object.entries(senalesRef.current ?? {})) {
          vista.signal(nombre, valor);
          vista.addSignalListener(nombre, (_, v) => avisoRef.current?.(nombre, v));
        }
        await vista.runAsync();
        if (!cancelado) setListo(true);
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

  // si el gráfico es más ancho que su caja, se avisa con un desvanecido en el borde (data-mas)
  useEffect(() => {
    const el = figura.current;
    if (!el) return;
    const medir = () => {
      setHayMas(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
      if (controles) setAlLado(lugarAlLado(el, vistaRef.current));
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ojo = new ResizeObserver(medir);
    ojo.observe(el);
    if (contenedor.current) ojo.observe(contenedor.current);
    return () => {
      el.removeEventListener("scroll", medir);
      ojo.disconnect();
    };
  }, [listo]);

  return (
    <figure ref={figura} className="grafico" data-mas={hayMas} tabIndex={0} aria-label={descripcion} data-cargando={!listo && !error}>
      {controles && (
        <div
          className="controles-grafico"
          data-al-lado={alLado ? "true" : "false"}
          style={alLado ? { left: alLado.left, top: alLado.top, width: alLado.width } : undefined}
          role="group"
          aria-labelledby={`${url}-filtros`}
          hidden={!listo}
        >
          <p className="titulo-controles" id={`${url}-filtros`}>
            Filtros
          </p>
          <div ref={enlaces} className="enlaces" />
        </div>
      )}
      <div ref={contenedor} />
      {error && <p className="error">No se pudo dibujar el gráfico: {error}</p>}
    </figure>
  );
}
