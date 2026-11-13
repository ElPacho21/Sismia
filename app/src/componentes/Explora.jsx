import { useMemo } from "react";
import Grafico from "./Grafico.jsx";

// parámetro de Altair -> campo del estado compartido (lo mismo que mueve el globo)
const CAMPO = { region: "region", mag_min: "magMin", ver: "ver", color_por: "colorPor" };

// La copa, primera parte: el usuario recorre los datos junto con lo que dijo el modelo.
// El gráfico es el mismo de Altair (specs/explora.json): sus controles son parámetros con nombre.
export default function Explora({ filtros, setFiltros }) {
  const senales = useMemo(
    () => ({ region: filtros.region, mag_min: filtros.magMin, ver: filtros.ver, color_por: filtros.colorPor }),
    [filtros],
  );
  return (
    <section id="explora" className="copa">
      <p className="etiqueta">Copa · Explorá</p>
      <h2>Recorré las 21.292 secuencias y mirá qué dijo el modelo sobre cada una</h2>
      <ul className="guia">
        <li>
          <strong>Panorama:</strong> cada círculo es un sismo principal; el tamaño es la magnitud y el color, la clase de réplicas. Los rectángulos son las
          cinco regiones.
        </li>
        <li>
          <strong>Filtrá:</strong> elegí la región, subí la magnitud mínima, o dibujá un rectángulo sobre el mapa para quedarte con una zona.
        </li>
        <li>
          <strong>Pintar según:</strong> compará el mapa pintado con la clase real y con la que dijo el modelo.
        </li>
        <li>
          <strong>Detalle:</strong> pasá el mouse por un círculo para ver lugar, fecha, lo que pasó, lo que dijo el modelo y sus probabilidades.
        </li>
        <li>
          Los controles son los mismos del globo de más abajo: lo que movés acá se mueve allá. Por defecto se muestran sólo las secuencias de <strong>test</strong> (las que el modelo no vio al entrenar). Si elegís «todas», el detalle indica cuáles
          son de entrenamiento: ahí el modelo se ve mejor de lo que es.
        </li>
      </ul>
      <Grafico
        url="specs/explora.json"
        descripcion="Mapa de las secuencias sísmicas coloreadas por clase de réplicas y, debajo, lo que dijo el modelo para cada clase real."
        senales={senales}
        controles
        alCambiarSenal={(nombre, valor) => setFiltros((f) => ({ ...f, [CAMPO[nombre]]: valor }))}
      />
      <p className="nota">
        Las barras de abajo responden a todos los controles: para cada clase real, qué proporción de las secuencias eligió el modelo en cada clase. Si el modelo acertara siempre, cada
        barra sería de un solo color.
      </p>
    </section>
  );
}
