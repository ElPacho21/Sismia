import { useEffect, useRef, useState } from "react";
import { calcular } from "../lib/api.js";
import { n, pct } from "../lib/formato.js";

// La copa, segunda parte: el usuario carga un caso nuevo y ve qué dice el modelo.
// El caso cargado y el resultado viven en App: el globo usa los mismos.
export const NOMBRE_REGION = {
  andes: "Andes",
  japan: "Japón",
  mexico_ca: "México y Centroamérica",
  philippines: "Filipinas",
  sumatra_java: "Sumatra y Java",
};
export const EJEMPLOS = [
  { nombre: "M6,0 en Japón, somero", magnitud: "6", profundidad: "30", region: "japan" },
  { nombre: "M7,5 en los Andes", magnitud: "7.5", profundidad: "30", region: "andes" },
  { nombre: "M4,8 en México", magnitud: "4.8", profundidad: "15", region: "mexico_ca" },
  { nombre: "M6,0 muy profundo", magnitud: "6", profundidad: "300", region: "japan" },
];

// Lo que escribió el usuario, convertido a número o a un mensaje de por qué no sirve (acá sólo lo que no tiene sentido).
function leerCaso(entrada) {
  const magnitud = Number(entrada.magnitud);
  const profundidad = Number(entrada.profundidad);
  if (entrada.magnitud.trim() === "" || !Number.isFinite(magnitud) || magnitud < 0 || magnitud > 10)
    return { error: "La magnitud tiene que ser un número entre 0 y 10." };
  if (entrada.profundidad.trim() === "" || !Number.isFinite(profundidad) || profundidad < 0 || profundidad > 800)
    return { error: "La profundidad tiene que ser un número entre 0 y 800 km." };
  return { caso: { magnitud, profundidad, region: entrada.region } };
}

// ¿el valor escrito no sirve? (para marcar el campo; el mensaje lo da leerCaso)
const fueraDeRango = (texto, maximo) => {
  const v = Number(texto);
  return texto.trim() === "" || !Number.isFinite(v) || v < 0 || v > maximo;
};

// Pide la predicción (servidor, o navegador si no contesta) cada vez que cambia el caso.
export function usePrediccion(modelo, entrada) {
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    if (!modelo) return;
    const { caso, error } = leerCaso(entrada);
    if (error) {
      setResultado({ rechazado: error });
      return;
    }
    const numero = ++pedido.current;
    setCalculando(true);
    const espera = setTimeout(async () => {
      const r = await calcular(modelo, caso);
      if (numero === pedido.current) {
        setResultado(r);
        setCalculando(false);
      }
    }, 250);
    return () => clearTimeout(espera);
  }, [entrada, modelo]);

  return { resultado, calculando };
}

// Los campos del caso: región, magnitud y profundidad.
export function CamposCaso({ modelo, entrada, setEntrada, conEjemplos = true }) {
  const cambiar = (campo) => (e) => setEntrada((x) => ({ ...x, [campo]: e.target.value }));
  const rangos = modelo.rangos;
  return (
    <form className="formulario" onSubmit={(e) => e.preventDefault()}>
      <label>
        Región
        <select name="region" autoComplete="off" value={entrada.region} onChange={cambiar("region")}>
          {Object.keys(modelo.mc_por_region).map((r) => (
            <option key={r} value={r}>
              {NOMBRE_REGION[r] ?? r} (Mc {n(modelo.mc_por_region[r], 1)})
            </option>
          ))}
        </select>
      </label>
      <label>
        Magnitud del sismo principal
        <input name="magnitud" autoComplete="off" type="number" inputMode="decimal" step="0.1" min="0" max="10" value={entrada.magnitud} onChange={cambiar("magnitud")} aria-invalid={fueraDeRango(entrada.magnitud, 10)} />
        <small>
          El modelo vio magnitudes de {n(rangos.magnitud[0], 1)} a {n(rangos.magnitud[1], 1)}.
        </small>
      </label>
      <label>
        Profundidad (km)
        <input name="profundidad" autoComplete="off" type="number" inputMode="decimal" step="1" min="0" max="800" value={entrada.profundidad} onChange={cambiar("profundidad")} aria-invalid={fueraDeRango(entrada.profundidad, 800)} />
        <small>
          El modelo vio profundidades de {n(rangos.profundidad[0])} a {n(rangos.profundidad[1])} km.
        </small>
      </label>
      {conEjemplos && (
        <div className="ejemplos">
          <span>Ejemplos:</span>
          {EJEMPLOS.map((ej) => (
            <button
              type="button"
              key={ej.nombre}
              onClick={() => setEntrada(ej)}
              aria-pressed={ej.magnitud === entrada.magnitud && ej.profundidad === entrada.profundidad && ej.region === entrada.region}
            >
              {ej.nombre}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

// La respuesta: clase, probabilidades, avisos y de dónde salió el cálculo.
export function Respuesta({ modelo, paleta, resultado, calculando, compacta = false }) {
  const colorDe = (clase) => paleta.color_clase[paleta.clases.indexOf(clase)];
  if (!resultado) return <div className="resultado" aria-live="polite" />;
  return (
    <div className={`resultado${compacta ? " compacta" : ""}`} aria-live="polite">
      {resultado.rechazado && <p className="rechazo">{resultado.rechazado}</p>}
      {!resultado.rechazado && (
        <>
          <p className="dice">El modelo dice</p>
          <p className="clase" key={resultado.clase} style={{ borderColor: colorDe(resultado.clase) }}>
            <span className="chip" style={{ background: colorDe(resultado.clase) }} />
            {resultado.clase}
          </p>
          <p className="esperadas">
            Réplicas esperadas en promedio: <strong>{n(resultado.replicas_esperadas, 1)}</strong>
          </p>
          {resultado.el_empuje_cambio_la_clase && (
            <p className="empuje">
              La clase más probable era <strong>{resultado.clase_mas_probable}</strong>, pero el modelo está ajustado para avisar de más (empuje {modelo.empuje}) y por eso contesta{" "}
              <strong>{resultado.clase}</strong>.
            </p>
          )}
          <ul className="barras">
            {paleta.clases.map((clase) => {
              const p = resultado.probabilidades[clase];
              return (
                <li key={clase}>
                  <span className="nombre">{clase}</span>
                  <span className="pista">
                    <span className="relleno" style={{ width: `${Math.max(p * 100, p > 0 ? 0.6 : 0)}%`, background: colorDe(clase) }} />
                  </span>
                  <span className="valor">{p < 0.001 && p > 0 ? "< 0,1 %" : pct(p * 100, 1)}</span>
                </li>
              );
            })}
          </ul>
          {resultado.avisos.length > 0 && (
            <div className="avisos" role="alert">
              <strong>Ojo: este caso está fuera de lo que el modelo vio.</strong>
              <ul>
                {resultado.avisos.map((a) => (
                  <li key={a.codigo}>{a.mensaje.replace(/(\d)\.(\d)/g, "$1,$2")}</li>
                ))}
              </ul>
              <span>La respuesta es una extrapolación: tomala con cautela.</span>
            </div>
          )}
          {resultado.origen !== "servidor" && (
            <p className={`origen ${resultado.origen}`}>
              {calculando ? "Calculando…" : "Calculado en tu navegador (el servidor no respondió a tiempo)"}
              {" · "}modelo {resultado.version_modelo}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ProbaModelo({ modelo, paleta, entrada, setEntrada, prediccion }) {
  return (
    <section id="proba" className="copa">
      <p className="etiqueta">Copa · Probá el modelo</p>
      <h2>Cargá un sismo nuevo y mirá cuántas réplicas espera el modelo</h2>
      <div className="proba">
        <CamposCaso modelo={modelo} entrada={entrada} setEntrada={setEntrada} />
        <Respuesta modelo={modelo} paleta={paleta} resultado={prediccion.resultado} calculando={prediccion.calculando} />
      </div>
    </section>
  );
}
