import Grafico from "./Grafico.jsx";

// La copa, primera parte: el usuario recorre los datos junto con lo que dijo el modelo.
// El gráfico es el mismo de Altair (specs/explora.json): sus controles son parámetros con nombre.
export default function Explora() {
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
          <strong>Zoom y filtro:</strong> elegí la región, subí la magnitud mínima, o dibujá un rectángulo sobre el mapa para quedarte con una zona.
        </li>
        <li>
          <strong>Pintar según:</strong> compará el mapa pintado con la clase real y con la que dijo el modelo.
        </li>
        <li>
          <strong>Detalle:</strong> pasá el mouse por un círculo para ver lugar, fecha, lo que pasó, lo que dijo el modelo y sus probabilidades.
        </li>
        <li>
          Por defecto se muestran sólo las secuencias de <strong>test</strong> (las que el modelo no vio al entrenar). Si elegís «todas», el detalle indica cuáles
          son de entrenamiento: ahí el modelo se ve mejor de lo que es.
        </li>
      </ul>
      <Grafico url="specs/explora.json" descripcion="Mapa de las secuencias sísmicas coloreadas por clase de réplicas y, debajo, lo que dijo el modelo para cada clase real." />
      <p className="nota">
        Las barras de abajo responden a todos los controles: para cada clase real, qué proporción de las secuencias eligió el modelo en cada clase. Si el modelo acertara siempre, cada
        barra sería de un solo color.
      </p>
    </section>
  );
}
