import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json";
import { EscenaGlobo, webglDisponible } from "../globo/escena.js";
import { centroRegion, eventosHasta, horasATexto, horasDeTiempoLog, tiempoLog } from "../globo/geo.js";
import { fecha, n } from "../lib/formato.js";
import { CamposCaso, NOMBRE_REGION, Respuesta } from "./ProbaModelo.jsx";

// El globo (extra de la copa): los mismos datos de Explorá en 3D, con la animación de una secuencia
// y la prueba del modelo. Se carga recién cuando el usuario llega hasta acá (ver GloboPuerta).
const DURACION_S = 14; // lo que tarda en correr toda la secuencia
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const reducirMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// geometrías de los continentes (Natural Earth 110m, empaquetado: no se pide nada afuera)
const TIERRA = feature(land, land.objects.land).features.map((f) => f.geometry);

const pedirJson = (ruta) => fetch(ruta).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${ruta}: ${r.status}`))));

export default function Globo({ d, filtros, setFiltros, entrada, setEntrada, prediccion }) {
  const { textos, metricas, regiones, modelo, paleta } = d;
  const opciones = textos.opciones;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [sinWebgl] = useState(() => !webglDisponible());
  const [secuencia, setSecuencia] = useState(null);
  const [tau, setTau] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const caja = useRef(null);
  const tip = useRef(null);
  const escenaRef = useRef(null);
  const filasRef = useRef(null);
  const eventosRef = useRef(null);
  const regionPrevia = useRef(null);
  const yaEntro = useRef(false);
  const datosRef = useRef(null);
  datosRef.current = datos;

  // datos del globo y, aparte, las filas con el detalle de cada secuencia (el mismo archivo de Explorá)
  useEffect(() => {
    Promise.all([pedirJson("data/globo.json"), pedirJson("data/explora_filas.json")])
      .then(([g, filas]) => {
        filasRef.current = filas;
        setDatos(g);
      })
      .catch((e) => setError(e.message));
  }, []);

  const soloTest = filtros.ver === opciones.ver[0];
  const colorPorReal = filtros.colorPor === opciones.color[0];

  // la escena se crea una vez que hay datos y se destruye al salir
  useEffect(() => {
    if (!datos || sinWebgl || !caja.current) return;
    const escena = new EscenaGlobo(caja.current, {
      datos,
      regiones,
      colores: paleta.color_clase,
      tierra: TIERRA,
      reducirMovimiento: reducirMovimiento(),
      alHover: mostrarDetalle,
      alClickPunto: (i) => elegirSecuencia(i),
      alClickRegion: (nombre) => {
        if (!nombre) return;
        setFiltros((f) => ({ ...f, region: nombre }));
      },
    });
    escenaRef.current = escena;
    escena.textoEtiquetas(Object.fromEntries(regiones.map((r) => [r.nombre, `${NOMBRE_REGION[r.nombre] ?? r.nombre} · f1 ${n(r.f1_test, 2)}`])));

    // la entrada cinematográfica ocurre la primera vez que el globo se ve; fuera de pantalla se pausa
    const ojo = new IntersectionObserver(
      ([e]) => {
        escena.pausar(!e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio > 0.35 && !yaEntro.current) {
          yaEntro.current = true;
          escena.entradaCinematografica();
        }
      },
      { threshold: [0, 0.35, 0.6] },
    );
    ojo.observe(caja.current);
    return () => {
      ojo.disconnect();
      escena.destruir();
      escenaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, sinWebgl]);

  // filtros compartidos con Explorá -> el globo; si cambió la región, la cámara vuela hasta ella
  useEffect(() => {
    const escena = escenaRef.current;
    if (!escena) return;
    escena.actualizarFiltros({ region: filtros.region, magMin: filtros.magMin, soloTest, colorPor: colorPorReal ? "real" : "pred" });
    escena.resaltarRegion(filtros.region === "todas" ? null : filtros.region);
    if (regionPrevia.current !== null && regionPrevia.current !== filtros.region && !secuencia) {
      const r = regiones.find((x) => x.nombre === filtros.region);
      if (r) escena.volarA(centroRegion(r).lat, centroRegion(r).lon, 2.2);
      else escena.volarA(12, 120, 3.1);
    }
    regionPrevia.current = filtros.region;
    if (filtros.region !== "todas") setEntrada((e) => (e.region === filtros.region ? e : { ...e, region: filtros.region }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, filtros, soloTest, colorPorReal]);

  // ---- detalle a pedido: se arma a mano sobre el DOM para no re-renderizar con cada movimiento del mouse
  function mostrarDetalle(i, x, y) {
    const el = tip.current;
    if (!el) return;
    const fila = i >= 0 ? filasRef.current?.[i] : null;
    if (!fila) {
      el.style.display = "none";
      return;
    }
    const color = (k) => paleta.color_clase[k];
    const animable = !!datosRef.current?.id[i];
    el.innerHTML = `
      <strong>${escapar(fila.lugar)}</strong>
      <span>${fecha(fila.fecha)} · M${n(fila.mag, 1)} · ${n(fila.prof, 0)} km · ${escapar(NOMBRE_REGION[fila.region] ?? fila.region)}</span>
      <span>Réplicas reales: <b>${n(fila.replicas)}</b> · <i style="background:${color(fila.real_i)}"></i>${escapar(fila.real)}</span>
      <span>El modelo dijo: <i style="background:${color(fila.pred_i)}"></i>${escapar(fila.pred)} (${fila.real_i === fila.pred_i ? "acertó" : "no acertó"})</span>
      <span class="${fila.test ? "" : "ojo"}">${fila.test ? "Sismo de test: el modelo no lo vio al entrenar" : "De entrenamiento: el modelo ya lo vio"}</span>
      <em>${animable ? "Click para animar su secuencia" : "Sin réplicas registradas: no hay secuencia para animar"}</em>`;
    el.style.display = "block";
    const w = caja.current.clientWidth;
    el.style.left = `${Math.min(x + 14, w - el.offsetWidth - 8)}px`;
    el.style.top = `${Math.max(y - el.offsetHeight - 10, 8)}px`;
  }

  // ---- una secuencia animada
  async function elegirSecuencia(i) {
    const escena = escenaRef.current;
    const g = datosRef.current;
    if (!escena || !g || !g.id[i]) return;
    eventosRef.current ??= await pedirJson("data/eventos_secuencias.json");
    const ev = eventosRef.current[g.id[i]];
    if (!ev) return;
    escena.cargarSecuencia(ev, g.real[i]);
    const fila = filasRef.current?.[i];
    setSecuencia({ indice: i, ev, sMax: tiempoLog(ev.h[ev.h.length - 1]), lugar: fila?.lugar ?? g.id[i], fecha: fila?.fecha, claseIdx: g.real[i] });
    setTau(0);
    setReproduciendo(!reducirMovimiento());
    mostrarDetalle(-1, 0, 0);
  }

  function limpiar() {
    escenaRef.current?.limpiarSecuencia();
    setSecuencia(null);
    setReproduciendo(false);
    setTau(0);
  }

  useEffect(() => {
    if (!reproduciendo || !secuencia) return;
    let ultimo = performance.now();
    let raf;
    const paso = (t) => {
      const dt = (t - ultimo) / 1000;
      ultimo = t;
      setTau((previo) => {
        const nuevo = Math.min(1, previo + dt / DURACION_S);
        if (nuevo >= 1) setReproduciendo(false);
        return nuevo;
      });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [reproduciendo, secuencia]);

  useEffect(() => {
    if (secuencia) escenaRef.current?.fijarTiempo(tau * secuencia.sMax);
  }, [tau, secuencia]);

  const reloj = useMemo(() => {
    if (!secuencia) return null;
    const s = tau * secuencia.sMax;
    return { texto: horasATexto(horasDeTiempoLog(s)), vistos: eventosHasta(secuencia.ev.h, s) };
  }, [tau, secuencia]);

  const resumenSecuencia = useMemo(() => {
    if (!secuencia) return null;
    const mags = secuencia.ev.mag;
    const mayor = Math.max(...mags);
    return { principal: mags[0], mayor, mayorVinoDespues: mayor > mags[0] + 0.05, total: mags.length, duracion: horasATexto(secuencia.ev.h[secuencia.ev.h.length - 1]) };
  }, [secuencia]);

  const region = regiones.find((r) => r.nombre === filtros.region);
  const destacadas = datos?.destacadas ?? [];

  if (sinWebgl)
    return <p className="globo-aviso">Tu navegador no tiene WebGL activado, así que el globo no puede dibujarse. Explorá y Probá el modelo cubren lo mismo en 2D.</p>;
  if (error) return <p className="error">No se pudo cargar el globo: {error}</p>;

  return (
    <div className="globo-grilla">
      <div className="globo-escena">
        <div className="globo-caja" ref={caja}>
          {!datos && <p className="globo-cargando">Cargando el globo…</p>}
          <div className="globo-detalle" ref={tip} style={{ display: "none" }} />
          <ul className="globo-leyenda" aria-label="Colores de las clases">
            {paleta.clases.map((c, i) => (
              <li key={c}>
                <i style={{ background: paleta.color_clase[i] }} />
                {c}
              </li>
            ))}
            <li className="chico">Tamaño = magnitud · anillos = sismos M7+</li>
          </ul>
          {reloj && (
            <div className="globo-reloj" aria-live="off">
              <strong>{reloj.texto}</strong>
              <span>desde el sismo principal · {n(reloj.vistos)} de {n(resumenSecuencia.total)} eventos</span>
            </div>
          )}
        </div>
        <div className="globo-teclas" role="group" aria-label="Mover el globo">
          <button type="button" onClick={() => escenaRef.current?.girar(-0.3, 0)} aria-label="Girar a la izquierda">←</button>
          <button type="button" onClick={() => escenaRef.current?.girar(0.3, 0)} aria-label="Girar a la derecha">→</button>
          <button type="button" onClick={() => escenaRef.current?.girar(0, 0.3)} aria-label="Girar hacia arriba">↑</button>
          <button type="button" onClick={() => escenaRef.current?.girar(0, -0.3)} aria-label="Girar hacia abajo">↓</button>
          <button type="button" onClick={() => escenaRef.current?.acercar(0.8)} aria-label="Acercar">+</button>
          <button type="button" onClick={() => escenaRef.current?.acercar(1.25)} aria-label="Alejar">−</button>
          <span>Arrastrá para girar, rueda para acercar, o usá las flechas con el globo enfocado.</span>
        </div>
      </div>

      <aside className="globo-panel">
        <section>
          <h3>Filtros (los mismos de Explorá)</h3>
          <div className="globo-filtros">
            <label>
              Región
              <select name="region" autoComplete="off" value={filtros.region} onChange={(e) => setFiltros((f) => ({ ...f, region: e.target.value }))}>
                <option value="todas">todas</option>
                {regiones.map((r) => (
                  <option key={r.nombre} value={r.nombre}>
                    {NOMBRE_REGION[r.nombre] ?? r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Magnitud mínima: {n(filtros.magMin, 1)}
              <input name="magnitud-minima" type="range" min="4" max="8" step="0.1" value={filtros.magMin} onChange={(e) => setFiltros((f) => ({ ...f, magMin: Number(e.target.value) }))} />
            </label>
            <label>
              Secuencias
              <select name="ver" autoComplete="off" value={filtros.ver} onChange={(e) => setFiltros((f) => ({ ...f, ver: e.target.value }))}>
                {opciones.ver.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Pintar según
              <select name="pintar-segun" autoComplete="off" value={filtros.colorPor} onChange={(e) => setFiltros((f) => ({ ...f, colorPor: e.target.value }))}>
                {opciones.color.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="nota">
            {region ? (
              <>
                <strong>{NOMBRE_REGION[region.nombre]}</strong>: Mc {n(region.mc, 1)}, {n(region.secuencias)} secuencias ({n(region.secuencias_test)} de test). En el test, f1{" "}
                <strong>{n(region.f1_test, 2)}</strong> y acierto del intervalo {n(region.acierto_test * 100, 0)} %. Es un único modelo para todas las regiones; este es su resultado en esta.
              </>
            ) : (
              <>
                Todas las regiones: f1 {n(metricas.final.f1_test, 2)} en el test. Clickeá una región en el globo, o elegila arriba, para ver su resultado.
              </>
            )}
          </p>
        </section>

        <section>
          <h3>Animá una secuencia</h3>
          <label>
            Elegí una
            <select name="secuencia" autoComplete="off" value={secuencia ? destacadas.find((x) => x.indice === secuencia.indice)?.id ?? "" : ""} onChange={(e) => {
              const x = destacadas.find((z) => z.id === e.target.value);
              if (x) elegirSecuencia(x.indice);
            }}>
              <option value="">{secuencia && !destacadas.some((x) => x.indice === secuencia.indice) ? secuencia.lugar : "Las más largas, o clickeá un punto del globo"}</option>
              {destacadas.map((x) => (
                <option key={x.id} value={x.id}>
                  {fecha(x.fecha)} · M{n(x.mag, 1)} · {n(x.eventos)} eventos · {x.lugar}
                </option>
              ))}
            </select>
          </label>
          {secuencia ? (
            <>
              <div className="globo-reproductor">
                <button type="button" onClick={() => { if (tau >= 1) setTau(0); setReproduciendo((r) => !r); }}>
                  {reproduciendo ? "⏸ Pausa" : "▶ Reproducir"}
                </button>
                <input name="momento" type="range" min="0" max="1000" value={Math.round(tau * 1000)} aria-label="Momento de la secuencia"
                  onChange={(e) => { setReproduciendo(false); setTau(Number(e.target.value) / 1000); }} />
                <button type="button" onClick={limpiar}>Quitar</button>
              </div>
              <div className="globo-reproductor encuadre">
                <button type="button" onClick={() => escenaRef.current?.encuadrar("nucleo")}>Acercar al núcleo</button>
                <button type="button" onClick={() => escenaRef.current?.encuadrar("todo")}>Ver toda la secuencia</button>
              </div>
              <p className="nota">
                <strong>{secuencia.lugar}</strong> ({secuencia.fecha ? fecha(secuencia.fecha) : ""}): principal M{n(resumenSecuencia.principal, 1)}, {n(resumenSecuencia.total)} eventos en {resumenSecuencia.duracion}. El tiempo corre en
                escala <strong>logarítmica</strong>: las primeras horas ocupan tanto como los últimos meses. La cámara se acerca al núcleo para que se vean separados; con la rueda o «Ver toda la secuencia» se ven también los más lejanos.
              </p>
              {resumenSecuencia.mayorVinoDespues && (
                <p className="aviso-chico">
                  El principal (el que abre la secuencia) fue M{n(resumenSecuencia.principal, 1)}, pero después hubo un M{n(resumenSecuencia.mayor, 1)}. Por eso con <code>mainshock = root</code> a este
                  sismo se le asignan las réplicas de toda la secuencia: es uno de los casos que el modelo subestima.
                </p>
              )}
            </>
          ) : (
            <p className="nota">Cada evento aparece en su momento, con un anillo del tamaño de su magnitud, pintado con la clase real de la secuencia.</p>
          )}
        </section>

        <section>
          <h3>Probá el modelo desde acá</h3>
          <CamposCaso modelo={modelo} entrada={entrada} setEntrada={setEntrada} conEjemplos={false} />
          <Respuesta modelo={modelo} paleta={paleta} resultado={prediccion.resultado} calculando={prediccion.calculando} compacta />
        </section>
      </aside>
    </div>
  );
}
