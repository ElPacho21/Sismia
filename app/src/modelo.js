// El modelo de la Entrega 3 escrito como fórmula. Es la misma que modelo_core.py (la usa la API);
// si la API no responde, la página calcula acá, en el navegador, con los coeficientes de model.json.
//
//   x = [mag - Mc de la región, profundidad]      z = (x - media) / escala
//   mu = exp(intercepto + coef · z)               (réplicas esperadas, Poisson)
//   probabilidades por intervalo con la acumulada de Poisson en los cortes 0, 2 y 10
//   puntaje = probabilidad / frecuencia ** empuje  ->  la clase es la de mayor puntaje

// log(i!) para i = 0..10 (los cortes llegan hasta 10)
const LOG_FACTORIAL = [0];
for (let i = 1; i <= 10; i++) LOG_FACTORIAL.push(LOG_FACTORIAL[i - 1] + Math.log(i));

// P(X <= k) para X ~ Poisson(mu), sumado en escala logarítmica para que no desborde con mu enorme
function acumuladaPoisson(k, mu) {
  if (mu <= 0) return 1;
  const logMu = Math.log(mu);
  let suma = 0;
  for (let i = 0; i <= k; i++) suma += Math.exp(i * logMu - mu - LOG_FACTORIAL[i]);
  return Math.min(1, suma);
}

function indiceMayor(valores) {
  let mejor = 0; // en empate gana el primero, igual que argmax
  for (let i = 1; i < valores.length; i++) if (valores[i] > valores[mejor]) mejor = i;
  return mejor;
}

export function predecir(modelo, magnitud, profundidad, region) {
  const mc = modelo.mc_por_region[region];
  const x = [magnitud - mc, profundidad];
  const z = x.map((v, i) => (v - modelo.media[i]) / modelo.escala[i]);
  const eta = modelo.intercepto + modelo.coef[0] * z[0] + modelo.coef[1] * z[1];
  const mu = Math.exp(Math.min(eta, 700)); // tope para no desbordar con casos absurdos
  const acum = modelo.cortes.map((k) => acumuladaPoisson(k, mu));
  const probs = [acum[0], acum[1] - acum[0], acum[2] - acum[1], 1 - acum[2]];
  const puntajes = probs.map((p, i) => p / Math.max(modelo.frecuencia[i], 1e-6) ** modelo.empuje);
  const elegida = indiceMayor(puntajes);
  return {
    mu,
    probs,
    puntajes,
    clase: modelo.clases[elegida],
    claseIdx: elegida,
    claseMasProbable: modelo.clases[indiceMayor(probs)], // la de mayor probabilidad cruda (sin empuje)
  };
}

// Advertencias para un caso que el modelo no vio al entrenar. Mismos códigos que modelo_core.py.
export function avisos(modelo, magnitud, profundidad, region) {
  const mc = modelo.mc_por_region[region];
  const [magLo, magHi] = modelo.rangos.magnitud;
  const [profLo, profHi] = modelo.rangos.profundidad;
  const out = [];
  if (magnitud < mc - 1e-9) {
    out.push({
      codigo: "mag_menor_mc",
      mensaje: `La magnitud ${magnitud} es menor que el umbral de detección de la región (${mc}): el modelo nunca vio sismos principales así.`,
    });
  }
  if (magnitud > magHi || magnitud < magLo) {
    out.push({ codigo: "mag_fuera_rango", mensaje: `Magnitud fuera del rango visto en el entrenamiento (${magLo} a ${magHi}).` });
  }
  if (profundidad > profHi || profundidad < profLo) {
    out.push({ codigo: "prof_fuera_rango", mensaje: `Profundidad fuera del rango visto en el entrenamiento (${profLo} a ${profHi} km).` });
  }
  return out;
}
