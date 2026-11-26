import { n } from "../lib/formato.js";
import { NOMBRE_REGION } from "./ProbaModelo.jsx";

// Los filtros de Explorá: se muestran arriba del globo y repetidos junto a las barras de abajo.
// Los dos juegos mueven el mismo estado (filtros de App), así que siempre muestran lo mismo.
// «Pintar según» sólo afecta al globo: las barras no lo muestran (conColor = false).
export default function Filtros({ id, filtros, setFiltros, regiones, opciones, conColor = true }) {
  const cambiar = (clave, valor) => setFiltros((f) => ({ ...f, [clave]: valor }));
  return (
    <div className="globo-filtros" role="group" aria-labelledby={id}>
      <span id={id} className="titulo-filtros">
        Filtros
      </span>
      <label>
        Región
        <select name="region" autoComplete="off" value={filtros.region} onChange={(e) => cambiar("region", e.target.value)}>
          <option value="todas">todas</option>
          {regiones.map((r) => (
            <option key={r.nombre} value={r.nombre}>
              {NOMBRE_REGION[r.nombre] ?? r.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="rango">
        Magnitud mínima: {n(filtros.magMin, 1)}
        <input
          name="magnitud-minima"
          type="range"
          min="4"
          max="8"
          step="0.1"
          value={filtros.magMin}
          onChange={(e) => cambiar("magMin", Number(e.target.value))}
        />
      </label>
      <label>
        Secuencias
        <select name="ver" autoComplete="off" value={filtros.ver} onChange={(e) => cambiar("ver", e.target.value)}>
          {opciones.ver.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      {conColor && (
        <label>
          Pintar según
          <select name="pintar-segun" autoComplete="off" value={filtros.colorPor} onChange={(e) => cambiar("colorPor", e.target.value)}>
            {opciones.color.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
