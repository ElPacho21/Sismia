"""El modelo de la Entrega 3, escrito como fórmula, sin scikit-learn.

Lo usan la API (api/) y los tests; el JS del navegador implementa exactamente la
misma fórmula leyendo model.json. El modelo original del notebook (sklearn) es la
referencia con la que se comparan las tres versiones (ver tests/test_paridad.py).

Fórmula:
    x      = [mag - Mc de la región, profundidad]
    z      = (x - media) / escala                  (StandardScaler del entrenamiento)
    mu     = exp(intercepto + coef · z)            (réplicas esperadas, Poisson)
    P(ninguna)   = F(0; mu)                        F = distribución acumulada de Poisson
    P(pocas)     = F(2; mu)  - F(0; mu)
    P(moderadas) = F(10; mu) - F(2; mu)
    P(muchas)    = 1 - F(10; mu)
    puntaje = P / frecuencia_de_la_clase ** empuje
    clase   = la de mayor puntaje
"""
import math

CORTES = [0, 2, 10]


def _cdf_poisson(k, mu):
    """P(X <= k) para X ~ Poisson(mu), sumando en escala logarítmica (estable con mu muy grande)."""
    if mu <= 0:
        return 1.0
    log_mu = math.log(mu)
    return min(1.0, sum(math.exp(i * log_mu - mu - math.lgamma(i + 1)) for i in range(k + 1)))


def predecir(modelo, magnitud, profundidad, region):
    """Devuelve réplicas esperadas, probabilidades por clase, puntajes y clase elegida."""
    mc = modelo["mc_por_region"][region]
    x = [magnitud - mc, profundidad]
    z = [(x[i] - modelo["media"][i]) / modelo["escala"][i] for i in range(2)]
    eta = modelo["intercepto"] + sum(modelo["coef"][i] * z[i] for i in range(2))
    mu = math.exp(min(eta, 700.0))                      # tope para no desbordar con casos absurdos
    acum = [_cdf_poisson(k, mu) for k in CORTES]
    probs = [acum[0], acum[1] - acum[0], acum[2] - acum[1], 1.0 - acum[2]]
    puntajes = [p / max(f, 1e-6) ** modelo["empuje"] for p, f in zip(probs, modelo["frecuencia"])]
    elegida = max(range(4), key=lambda i: puntajes[i])   # en empate gana la primera, igual que argmax
    mas_probable = max(range(4), key=lambda i: probs[i])  # la de mayor probabilidad CRUDA (sin empuje)
    return {"mu": mu, "probs": probs, "puntajes": puntajes,
            "clase": modelo["clases"][elegida], "clase_idx": elegida,
            "clase_mas_probable": modelo["clases"][mas_probable]}


def avisos(modelo, magnitud, profundidad, region):
    """Advertencias para un caso que el modelo no vio al entrenar. Cada una lleva un código
    (el mismo en JS) y un mensaje para mostrar. Lista vacía = el caso está dentro de lo visto."""
    r = modelo["rangos"]
    mc = modelo["mc_por_region"][region]
    out = []
    if magnitud < mc - 1e-9:
        out.append({"codigo": "mag_menor_mc",
                    "mensaje": f"La magnitud {magnitud} es menor que el umbral de detección de la región ({mc}): "
                               "el modelo nunca vio sismos principales así."})
    lo, hi = r["magnitud"]
    if magnitud > hi or magnitud < lo:
        out.append({"codigo": "mag_fuera_rango",
                    "mensaje": f"Magnitud fuera del rango visto en el entrenamiento ({lo} a {hi})."})
    lo, hi = r["profundidad"]
    if profundidad > hi or profundidad < lo:
        out.append({"codigo": "prof_fuera_rango",
                    "mensaje": f"Profundidad fuera del rango visto en el entrenamiento ({lo} a {hi} km)."})
    return out
