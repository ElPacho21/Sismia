import { avisos, predecir } from "../modelo.js";

const BASE = import.meta.env.VITE_API_URL ?? "";
const TIEMPO_LIMITE_MS = 4000;

// Despierta la función del servidor (arranque en frío) apenas carga la página.
export function despertarApi() {
  fetch(`${BASE}/api/health`).catch(() => {});
}

// La misma cuenta, en el navegador, con los coeficientes de model.json.
function calcularEnNavegador(modelo, { magnitud, profundidad, region }) {
  const r = predecir(modelo, magnitud, profundidad, region);
  return {
    clase: r.clase,
    clase_mas_probable: r.claseMasProbable,
    el_empuje_cambio_la_clase: r.clase !== r.claseMasProbable,
    probabilidades: Object.fromEntries(modelo.clases.map((c, i) => [c, r.probs[i]])),
    replicas_esperadas: r.mu,
    region,
    mc_region: modelo.mc_por_region[region],
    avisos: avisos(modelo, magnitud, profundidad, region),
    version_modelo: modelo.version,
    origen: "navegador",
  };
}

// Pide la predicción al servidor; si no contesta a tiempo (o falla), la calcula en el navegador.
// Si el servidor rechaza el caso por no tener sentido (422), no se cae al navegador: se muestra el motivo.
export async function calcular(modelo, caso) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_LIMITE_MS);
  try {
    const r = await fetch(`${BASE}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caso),
      signal: control.signal,
    });
    if (r.status === 422) {
      const { detail } = await r.json();
      const motivo = Array.isArray(detail) ? detail.map((d) => d.msg.replace(/^Value error, /, "")).join(" ") : detail;
      return { rechazado: motivo };
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return calcularEnNavegador(modelo, caso);
  } finally {
    clearTimeout(reloj);
  }
}
