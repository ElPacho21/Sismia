// Números con formato español-argentino: 21.292 y 0,50.
export const n = (valor, decimales = 0) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valor);
export const pct = (valor, decimales = 1) => `${n(valor, decimales)} %`;

// Idioma de los gráficos de Vega: miles con punto, decimales con coma.
export const LOCALE_VEGA = { decimal: ",", thousands: ".", grouping: [3], currency: ["$", ""] };

// Fecha ISO (YYYY-MM-DD o con hora) a DD/MM/AAAA
export const fecha = (iso) => iso.slice(0, 10).split("-").reverse().join("/");
