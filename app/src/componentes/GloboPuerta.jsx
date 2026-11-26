import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { n } from "../lib/formato.js";
import ResultadoExplora from "./Explora.jsx";

// El globo pesa (three y los continentes): no se descarga hasta que el usuario está por llegar a esta sección.
const Globo = lazy(() => import("./Globo.jsx"));

// La copa, primera parte: Explorá. El panorama es el globo; abajo, las barras de Altair con el resultado del modelo.
export default function GloboPuerta(props) {
  const { d } = props;
  const marco = useRef(null);
  const [cerca, setCerca] = useState(false);
  const total = d.metricas.particion.entrenamiento + d.metricas.particion.test;

  useEffect(() => {
    const ojo = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setCerca(true);
          ojo.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    ojo.observe(marco.current);
    return () => ojo.disconnect();
  }, []);

  return (
    <section id="explora" className="copa" ref={marco}>
      <p className="etiqueta">Copa · Explorá</p>
      <h2>Recorré las {n(total)} secuencias y mirá qué dijo el modelo sobre cada una</h2>
      <p className="puente">
        Hasta acá contamos lo que encontramos nosotros. Ahora te toca a vos: los mismos datos, con lo que dijo el modelo sobre cada secuencia, para
        que busques dónde acierta y dónde se equivoca.
      </p>
      <ul className="guia">
        <li>
          <strong>Panorama:</strong> cada punto del globo es un sismo principal; el tamaño es la magnitud y el color, la clase de réplicas. Los anillos marcan los
          sismos de M7 o más, y cada región lleva su f1 en el test.
        </li>
        <li>
          <strong>Filtrá:</strong> elegí la región (o clickeala en el globo), subí la magnitud mínima o elegí qué secuencias ver. Por defecto se muestran sólo las de{" "}
          <strong>test</strong>, las que el modelo no vio al entrenar; con «todas» se suman las de entrenamiento, donde el modelo se ve mejor de lo que es.
        </li>
        <li>
          <strong>Pintar según:</strong> compará el globo pintado con la clase real y con la que dijo el modelo.
        </li>
        <li>
          <strong>Detalle:</strong> pasá el mouse por un punto para ver lugar, fecha, lo que pasó, lo que dijo el modelo y sus probabilidades. Clickealo, o elegí una
          de la lista, para animar la secuencia: el anillo de cada evento nace cuando le toca, en un tiempo logarítmico (las primeras horas, cuando hay más
          réplicas, ocupan tanto como los últimos meses).
        </li>
      </ul>
      {cerca ? (
        <Suspense fallback={<p className="globo-cargando-fuera">Cargando el globo…</p>}>
          <Globo {...props} />
        </Suspense>
      ) : (
        <div className="globo-reserva" />
      )}
      <ResultadoExplora d={d} filtros={props.filtros} setFiltros={props.setFiltros} />
    </section>
  );
}
