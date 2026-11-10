// Tabla simple: columnas = [{ titulo, ver(fila), alinear }]
export default function Tabla({ columnas, filas, leyenda, resaltar }) {
  return (
    <div className="tabla-caja">
      <table>
        {leyenda && <caption>{leyenda}</caption>}
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={c.alinear}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={resaltar && resaltar(f) ? "resaltada" : undefined}>
              {columnas.map((c) => (
                <td key={c.titulo} className={c.alinear}>
                  {c.ver(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
