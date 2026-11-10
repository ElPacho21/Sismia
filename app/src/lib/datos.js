// Todo lo que muestra la página sale de estos archivos, que genera build_app.py.
const ARCHIVOS = {
  textos: "data/textos.json",
  metricas: "data/metricas.json",
  hipotesis: "data/hipotesis.json",
  pasos: "data/pasos_filtrado.json",
  regiones: "data/regiones.json",
  modelo: "data/model.json",
  paleta: "data/paleta.json",
};

export async function cargarDatos() {
  const pares = await Promise.all(
    Object.entries(ARCHIVOS).map(async ([clave, ruta]) => {
      const r = await fetch(ruta);
      if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
      return [clave, await r.json()];
    }),
  );
  return Object.fromEntries(pares);
}
