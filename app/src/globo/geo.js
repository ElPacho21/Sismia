// Funciones puras del globo (sin three ni DOM), para poder probarlas.

const RAD = Math.PI / 180;

// Latitud y longitud (grados) a un punto sobre una esfera de radio r.
// Convención: +y es el Polo Norte; la longitud 0 mira hacia +x y crece hacia el este.
export function latLonAVec3(lat, lon, r = 1) {
  const cosLat = Math.cos(lat * RAD);
  return [r * cosLat * Math.cos(lon * RAD), r * Math.sin(lat * RAD), -r * cosLat * Math.sin(lon * RAD)];
}

export function vec3ALatLon([x, y, z]) {
  const r = Math.hypot(x, y, z);
  return { lat: Math.asin(y / r) / RAD, lon: Math.atan2(-z, x) / RAD };
}

// Región (por su rectángulo) a la que pertenece un punto, o null.
export function regionDe(lat, lon, regiones) {
  return regiones.find((r) => lat >= r.sur && lat <= r.norte && lon >= r.oeste && lon <= r.este)?.nombre ?? null;
}

export function centroRegion(r) {
  return { lat: (r.sur + r.norte) / 2, lon: (r.oeste + r.este) / 2 };
}

// ---- el reloj de la animación ----
// Las secuencias duran desde horas hasta años: el tiempo corre en escala logarítmica,
// s = log10(1 + horas desde el sismo principal). Así el estallido inicial y la cola larga ocupan lo mismo.
export const tiempoLog = (horas) => Math.log10(1 + horas);
export const horasDeTiempoLog = (s) => 10 ** s - 1;

const fmt = (v, d) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// "hace" X desde el sismo principal, en la unidad que corresponda
export function horasATexto(horas) {
  if (horas < 1) return `${fmt(Math.round(horas * 60), 0)} min`;
  if (horas < 48) return `${fmt(horas, 1)} horas`;
  const dias = horas / 24;
  if (dias < 60) return `${fmt(dias, 1)} días`;
  if (dias < 730) return `${fmt(dias / 30.44, 1)} meses`;
  return `${fmt(dias / 365.25, 1)} años`;
}

// Tamaño en el mundo (esfera de radio 1) de un punto según la magnitud: el área crece con la energía aparente.
export const tamanoPorMagnitud = (mag) => 0.0035 + 0.0032 * Math.max(0, mag - 4);

// Cuántos eventos de una secuencia ya ocurrieron al tiempo logarítmico s (horas ordenadas de menor a mayor).
export function eventosHasta(horas, s) {
  let n = 0;
  while (n < horas.length && tiempoLog(horas[n]) <= s + 1e-12) n++;
  return n;
}

// Interpolación suave para los vuelos de cámara
export const suavizar = (t) => t * t * (3 - 2 * t);
