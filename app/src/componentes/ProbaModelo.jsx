import { useEffect, useMemo, useRef, useState } from "react";
import { calcular, calcularEnNavegador } from "../lib/api.js";
import { colorEnTema, useTema } from "../lib/tema.js";
import { n, pct } from "../lib/formato.js";
import { predecir } from "../modelo.js";

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

// Cada vez que cambia el caso: la respuesta del navegador al instante (el anticipo, para que los sliders y el mapa
// responda mientras se arrastra un slider) y, si el caso se queda quieto 250 ms, la del servidor (o el navegador si no contesta).
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
    setResultado(calcularEnNavegador(modelo, caso, "anticipo"));
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

// El recorrido de los sliders: un poco más que lo que vio el modelo, para que se vea dónde termina.
const DOMINIO_MAG = [4, 9.5];
const DOMINIO_PROF = [0, 700];

// Los tramos de cada slider fuera de lo que vio el modelo al entrenar (se rayan): por debajo del umbral de la región o de
// la menor magnitud vista, por encima de la mayor, y más profundo que el más profundo.
function zonasFuera(modelo, region) {
  const mc = modelo.mc_por_region[region];
  const [magLo, magHi] = modelo.rangos.magnitud;
  return {
    magnitud: [
      [DOMINIO_MAG[0], Math.max(magLo, mc)],
      [magHi, DOMINIO_MAG[1]],
    ],
    profundidad: [[modelo.rangos.profundidad[1], DOMINIO_PROF[1]]],
  };
}

// Las bandas de clase a lo largo de un slider: qué contesta el modelo en cada valor, con lo demás fijo.
// Bordes netos entre clases: no es un degradado, cada tramo es un color plano.
function bandas(dominio, clasePara, colores) {
  const [a, b] = dominio;
  const pasos = 220;
  const tramos = [];
  for (let i = 0; i <= pasos; i++) {
    const v = a + ((b - a) * i) / pasos;
    const k = clasePara(v);
    if (tramos.length && tramos[tramos.length - 1].k === k) continue;
    tramos.push({ k, desde: v });
  }
  const pc = (v) => `${(((v - a) / (b - a)) * 100).toFixed(2)}%`;
  return tramos.map((t, i) => `${colores[t.k]} ${pc(i ? t.desde : a)} ${pc(i < tramos.length - 1 ? tramos[i + 1].desde : b)}`).join(", ");
}

// Un slider con la pista pintada por la clase que contesta el modelo en cada punto y rayada donde el modelo no vio datos.
function Deslizador({ nombre, etiqueta, valor, dominio, paso, formato, pista, fuera, onChange }) {
  const pc = (v) => ((v - dominio[0]) / (dominio[1] - dominio[0])) * 100;
  return (
    <label className="deslizador">
      <span className="rotulo">
        {etiqueta}
        <output className="valor">{formato(valor)}</output>
      </span>
      <span className="riel">
        <span className="pista" style={{ background: `linear-gradient(to right, ${pista})` }}>
          {fuera
            .filter(([x0, x1]) => x1 > x0)
            .map(([x0, x1]) => (
              <span key={x0} className="fuera" style={{ left: `${pc(x0)}%`, width: `${pc(x1) - pc(x0)}%` }} />
            ))}
        </span>
        <input name={nombre} type="range" min={dominio[0]} max={dominio[1]} step={paso} value={valor} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

// Los campos del caso: región, magnitud y profundidad (sliders) y los ejemplos.
function CamposCaso({ modelo, paleta, entrada, setEntrada }) {
  const contextoTema = useTema();
  const cambiar = (campo) => (valor) => setEntrada((x) => ({ ...x, [campo]: valor }));
  const mag = Number(entrada.magnitud);
  const prof = Number(entrada.profundidad);
  const fuera = zonasFuera(modelo, entrada.region);
  const pistas = useMemo(() => {
    const colores = paleta.color_clase.map((c) => colorEnTema(c, contextoTema));
    const clase = (m, p) => predecir(modelo, m, p, entrada.region).claseIdx;
    return {
      magnitud: bandas(DOMINIO_MAG, (m) => clase(m, prof), colores),
      profundidad: bandas(DOMINIO_PROF, (p) => clase(mag, p), colores),
    };
  }, [modelo, paleta, contextoTema, entrada.region, mag, prof]);
  return (
    <form className="formulario" onSubmit={(e) => e.preventDefault()}>
      <label>
        Región
        <select name="region" autoComplete="off" value={entrada.region} onChange={(e) => cambiar("region")(e.target.value)}>
          {Object.keys(modelo.mc_por_region).map((r) => (
            <option key={r} value={r}>
              {NOMBRE_REGION[r] ?? r} (Mc {n(modelo.mc_por_region[r], 1)})
            </option>
          ))}
        </select>
      </label>
      <Deslizador
        nombre="magnitud"
        etiqueta="Magnitud del sismo principal"
        valor={mag}
        dominio={DOMINIO_MAG}
        paso={0.1}
        formato={(v) => `M${n(v, 1)}`}
        pista={pistas.magnitud}
        fuera={fuera.magnitud}
        onChange={cambiar("magnitud")}
      />
      <Deslizador
        nombre="profundidad"
        etiqueta="Profundidad"
        valor={prof}
        dominio={DOMINIO_PROF}
        paso={1}
        formato={(v) => `${n(v)} km`}
        pista={pistas.profundidad}
        fuera={fuera.profundidad}
        onChange={cambiar("profundidad")}
      />
      <p className="nota-pista">
        Cada pista se pinta con lo que contestaría el modelo en ese punto. <span className="muestra-fuera" aria-hidden="true" />
        Rayado: fuera de lo que vio al entrenar (de M{n(modelo.rangos.magnitud[0], 1)} a M{n(modelo.rangos.magnitud[1], 1)} y desde el umbral de la región; hasta{" "}
        {n(modelo.rangos.profundidad[1])} km).
      </p>
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
    </form>
  );
}

// La respuesta: clase, probabilidades, avisos y de dónde salió el cálculo.
function Respuesta({ modelo, paleta, resultado, calculando }) {
  const contextoTema = useTema();
  const colorDe = (clase) => colorEnTema(paleta.color_clase[paleta.clases.indexOf(clase)], contextoTema);
  if (!resultado) return <div className="resultado" aria-live="polite" />;
  return (
    <div className="resultado" aria-live="polite">
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
          {resultado.origen === "navegador" && !calculando && (
            <p className="origen navegador">Calculado en tu navegador (el servidor no respondió a tiempo) · modelo {resultado.version_modelo}</p>
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
        <CamposCaso modelo={modelo} paleta={paleta} entrada={entrada} setEntrada={setEntrada} />
        <Respuesta modelo={modelo} paleta={paleta} resultado={prediccion.resultado} calculando={prediccion.calculando} />
      </div>
    </section>
  );
}
