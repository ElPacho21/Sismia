import { useEffect, useState } from "react";
import { cargarDatos } from "./lib/datos.js";
import { despertarApi } from "./lib/api.js";
import { n, pct } from "./lib/formato.js";
import Tallo from "./componentes/Tallo.jsx";
import ComoDatos from "./componentes/ComoDatos.jsx";
import ComoHallazgo from "./componentes/ComoHallazgo.jsx";
import ComoModelo from "./componentes/ComoModelo.jsx";
import Explora from "./componentes/Explora.jsx";
import ProbaModelo from "./componentes/ProbaModelo.jsx";

const NAV = [
  ["proyecto", "El proyecto"],
  ["datos", "Los datos"],
  ["encontramos", "Lo que encontramos"],
  ["modelo", "El modelo"],
  ["explora", "Explorá"],
  ["proba", "Probá el modelo"],
];

export default function App() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    despertarApi(); // la función del servidor arranca en frío: se la despierta ya
    cargarDatos().then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error centro">No se pudo cargar la aplicación: {error}</p>;
  if (!d) return <p className="cargando centro">Cargando…</p>;

  const { textos, metricas, hipotesis, pasos, regiones, modelo, paleta } = d;
  const total = metricas.particion.entrenamiento + metricas.particion.test;

  return (
    <>
      <nav className="barra" aria-label="Secciones">
        <a className="marca" href="#proyecto">
          Sisimia
        </a>
        {NAV.map(([id, nombre]) => (
          <a key={id} href={`#${id}`}>
            {nombre}
          </a>
        ))}
      </nav>

      <main>
        <header id="proyecto" className="portada">
          <p className="etiqueta">El proyecto</p>
          <p className="pregunta">{textos.pregunta}</p>
          <h1>{textos.oracion}</h1>
          <ul className="numeros">
            {textos.numeros.map((x) => (
              <li key={x.valor}>
                <span className="valor">{x.valor}</span>
                <span className="texto">{x.texto}</span>
              </li>
            ))}
          </ul>
          <p className="nota">
            Proyecto integrador de Ciencia de Datos (UTN FRM). {n(total)} secuencias sísmicas de cinco regiones de subducción, 2003–2025.
          </p>
        </header>

        <div className="tallo-grupo">
          <Tallo
            id="datos"
            numero="1"
            etiqueta="Los datos"
            titulo={textos.titulo_datos}
            spec="specs/datos.json"
            descripcion="Barras con la cantidad de secuencias en cada intervalo de réplicas."
            queMirar={
              <p>
                Mirá la barra gris: casi todo el dataset son secuencias sin ninguna réplica. Por eso un modelo que contesta siempre «ninguna» acierta el{" "}
                {pct(metricas.piso.accuracy_test * 100, 0)} de las veces y no sirve para nada, y por eso la métrica tiene que mirar las cuatro clases por igual.
              </p>
            }
          >
            <ComoDatos pasos={pasos} metricas={metricas} regiones={regiones} />
          </Tallo>

          <Tallo
            id="encontramos"
            numero="2"
            etiqueta="Lo que encontramos"
            titulo={textos.titulo_hallazgo}
            spec="specs/hallazgo.json"
            descripcion="Réplicas medias según cuánto supera la magnitud al umbral de la región, en escala logarítmica."
            queMirar={
              <p>
                Cada punto es un tramo de magnitud; el eje vertical es logarítmico, así que los puntos casi alineados son un crecimiento por un factor constante. Los
                puntos chicos de la derecha son pocas secuencias: ahí el promedio lo mueven uno o dos megasismos. Y ojo, la magnitud sola <strong>no</strong> alcanza: entre
                los {n(hipotesis.h4.n)} sismos de M6 o más hay de {hipotesis.h4.minimo} a {n(hipotesis.h4.maximo)} réplicas.
              </p>
            }
          >
            <ComoHallazgo hipotesis={hipotesis} metricas={metricas} />
          </Tallo>

          <Tallo
            id="modelo"
            numero="3"
            etiqueta="El modelo"
            titulo={textos.titulo_modelo}
            spec="specs/modelo.json"
            descripcion="Puntos con barras de desvío: f1 macro de cada modelo en validación, con el piso marcado."
            queMirar={
              <p>
                La línea punteada es el piso (contestar siempre «ninguna»). Cada punto es un modelo; la barra, su desvío entre folds. El elegido es el azul verdoso: le gana al piso por
                mucho, pero queda dentro de un desvío de otros dos Poisson, así que lo elegimos por ser el más simple. En el test, que no vio nunca, llega a un f1 de{" "}
                {n(metricas.final.f1_test, 2)}. Sirve para priorizar qué vigilar, no para emitir alertas: por cada {n(metricas.avisos_test.avisos_correctos)} avisos correctos hay{" "}
                {n(metricas.avisos_test.falsas_alarmas)} falsas alarmas.
              </p>
            }
          >
            <ComoModelo metricas={metricas} modelo={modelo} />
          </Tallo>
        </div>

        <Explora />
        <ProbaModelo modelo={modelo} paleta={paleta} />
      </main>

      <footer className="pie">
        Sisimia · datos: USGS · modelo: regresión de Poisson por intervalos · código: pipeline, análisis y modelo en el repositorio.
      </footer>
    </>
  );
}
