import { useMemo } from "react";
import Grafico from "./Grafico.jsx";
import Filtros from "./Filtros.jsx";

// Debajo del globo: qué dijo el modelo para lo que realmente fue cada clase (Altair, specs/resultado.json).
// Sus parámetros (region, mag_min, ver) son los filtros del globo; se repiten acá para no tener que subir a cambiarlos.
export default function ResultadoExplora({ d, filtros, setFiltros }) {
  const senales = useMemo(() => ({ region: filtros.region, mag_min: filtros.magMin, ver: filtros.ver }), [filtros]);
  return (
    <div className="resultado-explora">
      <h3 className="subtitulo">Lo que dijo el modelo, con los mismos filtros</h3>
      <Filtros
        id="resultado-filtros-titulo"
        filtros={filtros}
        setFiltros={setFiltros}
        regiones={d.regiones}
        opciones={d.textos.opciones}
        conColor={false}
      />
      <Grafico
        url="specs/resultado.json"
        descripcion="Para cada clase real, qué proporción de las secuencias filtradas puso el modelo en cada clase."
        senales={senales}
      />
      <p className="nota">
        Cada barra es lo que realmente pasó; sus colores, lo que dijo el modelo para esas secuencias. Responde a la región, la magnitud mínima y la partición
        elegidas: estos filtros son los mismos del globo, y cambiarlos acá también lo cambia allá. Si el modelo acertara siempre, cada barra sería de un solo color.
      </p>
    </div>
  );
}
