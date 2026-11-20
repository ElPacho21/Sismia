"""Genera todo lo que consume la aplicación Sisimia a partir de los datos del pipeline.

    python build_app.py

1. Lee el dataset de secuencias y los eventos que publica el pipeline (carpeta data/).
2. Entrena el modelo de la Entrega 3 con la misma semilla y lo compara contra
   tests/reference_metrics.json (los números del notebook). Si no coincide, FALLA.
3. Calcula la predicción de cada secuencia, marcando si es de entrenamiento o de test.
4. Escribe en app/public/data/: secuencias, eventos (para animar), regiones, paleta,
   model.json, métricas y pasos de filtrado; en app/public/specs/ los gráficos (Altair).
   Y en tests/golden.json los casos de paridad.

Es determinista: correrlo dos veces da archivos idénticos.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from sklearn.base import clone
from sklearn.inspection import permutation_importance
from scipy.stats import pearsonr, spearmanr
from sklearn.metrics import accuracy_score, recall_score, classification_report, confusion_matrix, f1_score, make_scorer
from sklearn.model_selection import TimeSeriesSplit

import modelo_core
from palette import CLASES, COLOR_CLASE, COLOR_MAYOR, COLOR_PARTICION, COLOR_PRINCIPAL
import graficos
from referencia_sklearn import (a_intervalo, candidatos, con_columnas, con_mc, crudas, esperadas_de_validacion,
                                modelo_final, PoissonIntervalos, real_sobre_predicho, tabla_cortes, validar_extras,
                                COLUMNAS_NUEVAS)

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "data"
SALIDA = RAIZ / "app" / "public" / "data"
SEMILLA = 42
ALPHA, EMPUJE = 0.001, 0.4            # elegidos en la Entrega 3 (celdas 62 y 68)
ARCHIVO = "clusters_combined_5regions_rmax=gk3_mainshock=root_seed=1.csv"
NO_REPRODUCEN_EXACTO = {"random forest (balanced)", "gradient boosting (balanced)"}
TRAMOS = ([4, 5, 6, 7, 10], ["4–5", "5–6", "6–7", "7 o más"])
EVENTOS = "events_*rmax=gk3_mainshock=root_seed=1.csv"

# Las 27 columnas del dataset, cada una en un grupo y con el motivo (mismo criterio que la celda 12 de la Entrega 3
# y el notebook «Análisis Exploratorio (dataset final)»). El build falla si el dataset trae una columna que no está acá.
G = graficos.GRUPOS_COLUMNAS
COLUMNAS = {
    G[0]: {"cluster_id": "Clave de la secuencia.", "mainshock_id": "Identificador del sismo principal en USGS.",
           "mainshock_place": "Texto libre del lugar.",
           "mainshock_time": "Fecha y hora: ordena y parte en entrenamiento y test, no es una entrada."},
    G[1]: {"n_aftershocks": "Es la respuesta: la cantidad de réplicas.", "has_aftershock": "Es la respuesta en versión sí/no."},
    G[2]: {"n_events": "Es n_aftershocks + 1: la respuesta disfrazada.",
           "duration_days": "Cuánto duró la secuencia: se sabe recién cuando terminó.",
           "extent_km": "Qué tan lejos llegaron las réplicas: se sabe al final.",
           "max_generation": "Réplicas de réplicas: se sabe al final."},
    G[3]: {"n_foreshocks": "Siempre 0: con mainshock = root el principal es el primer evento.",
           "root_is_mainshock": "Siempre verdadera por construcción con mainshock = root."},
    G[4]: {"mainshock_lat": "Latitud del epicentro.", "mainshock_lon": "Longitud del epicentro.",
           "region_log10_eta0": "Umbral del método de agrupamiento de la región.",
           "n_prior_2d": "Sismos cercanos en los 2 días previos.", "n_prior_365d": "Sismos cercanos en el año previo.",
           "prior_max_mag_365d": "Mayor magnitud de esos sismos del año previo.",
           "days_since_prior": "Días desde el sismo previo más reciente.",
           "prior_window_truncated": "La ventana de un año empieza antes que el catálogo.",
           "dist_to_border_km": "Distancia al borde del rectángulo de la región.",
           "near_border": "Cerca del borde del rectángulo.",
           "region": "Una columna 0/1 por región.",
           "n_prior_30d": "Sismos de los 30 días previos."},
    G[5]: {"mainshock_mag": "Magnitud del principal: entra como mag_sobre_mc = magnitud − Mc de la región.",
           "region_mc": "Mc de la región: entra dentro de mag_sobre_mc.",
           "mainshock_depth": "Profundidad del principal."},
}


def guardar(nombre, objeto, carpeta=SALIDA):
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_text(json.dumps(objeto, ensure_ascii=False, sort_keys=True,
                                             separators=(",", ":")), encoding="utf8")


def f1m(real, pred):
    return f1_score(real, pred, average="macro", labels=CLASES)


# ---------------------------------------------------------------- 1. datos
def cargar():
    df = pd.read_csv(DATOS / ARCHIVO, low_memory=False)
    df["mainshock_time"] = pd.to_datetime(df["mainshock_time"])
    df = df.sort_values("mainshock_time").reset_index(drop=True)      # el orden cronológico ES la partición
    # la magnitud mayor de cada secuencia (sale de los eventos): dice si después del principal vino uno más grande
    eventos = pd.concat([pd.read_csv(f, usecols=["mag", "cluster_id"]) for f in sorted(DATOS.glob(EVENTOS))])
    df["mag_max"] = df["cluster_id"].map(eventos.groupby("cluster_id")["mag"].max())
    if df["mag_max"].isna().any():
        sys.exit("HAY SECUENCIAS SIN EVENTOS EN LOS ARCHIVOS DE REGIÓN")
    corte = int(len(df) * 0.8)
    df["particion"] = np.where(df.index < corte, "entrenamiento", "test")
    return df, corte


# ---------------------------------------------------------------- 2. modelo y validación
def entrenar_y_medir(df, corte):
    cols = ["mainshock_mag", "mainshock_depth", "region_mc", "region", "n_prior_30d"]
    X, y = df[cols], df["n_aftershocks"]
    X_tr, X_te, y_tr, y_te = X.iloc[:corte], X.iloc[corte:], y.iloc[:corte], y.iloc[corte:]
    folds = list(TimeSeriesSplit(n_splits=5).split(X_tr))

    notas = []                                                         # validación cruzada temporal, 5 folds
    for e, v in folds:
        m = modelo_final(ALPHA, EMPUJE).fit(X_tr.iloc[e], y_tr.iloc[e])
        notas.append(f1m(a_intervalo(y_tr.iloc[v]), m.predict(X_tr.iloc[v])))
    # piso en validación: contesta siempre "ninguna"
    notas_piso = [f1m(a_intervalo(y_tr.iloc[v]), np.array([CLASES[0]] * len(v))) for _, v in folds]

    modelo = modelo_final(ALPHA, EMPUJE).fit(X_tr, y_tr)
    real, pred = a_intervalo(y_te), modelo.predict(X_te)
    piso = np.array([CLASES[0]] * len(y_te))
    con = real != CLASES[0]
    avisa = pred != CLASES[0]
    tramo = pd.cut(X_te["mainshock_mag"], TRAMOS[0], labels=TRAMOS[1], right=False)
    rep = classification_report(real, pred, labels=CLASES, output_dict=True, zero_division=0)

    reg = modelo.named_steps["modelo"].regresion_
    esc = modelo.named_steps["escalar"]
    coef_real = reg.coef_ / esc.scale_
    perm = permutation_importance(modelo, X_te, y_te, scoring=make_scorer(lambda a, p: f1m(a_intervalo(a), p)),
                                  n_repeats=20, random_state=SEMILLA)
    medidas = {
        "piso": {"f1_validacion": float(np.mean(notas_piso)), "desvio_validacion": float(np.std(notas_piso)),
                 "f1_test": f1m(real, piso), "accuracy_test": accuracy_score(real, piso)},
        "final": {"alpha": ALPHA, "empuje": EMPUJE, "f1_validacion": float(np.mean(notas)),
                  "desvio_validacion": float(np.std(notas)), "f1_por_fold": [float(n) for n in notas],
                  "f1_test": f1m(real, pred), "accuracy_test": accuracy_score(real, pred)},
        "avisos_test": {"con_replicas": int(con.sum()), "avisados_pct": float(avisa[con].mean() * 100),
                        "falsas_alarmas": int((avisa & ~con).sum()), "avisos_correctos": int((avisa & con).sum())},
        "reporte_test": {c: {"precision": rep[c]["precision"], "recall": rep[c]["recall"],
                             "f1": rep[c]["f1-score"], "support": int(rep[c]["support"])} for c in CLASES},
        "matriz_confusion_test": confusion_matrix(real, pred, labels=CLASES).tolist(),
        "acierto_por_tramo_test": {t: float((real == pred)[(tramo == t).to_numpy()].mean() * 100) for t in TRAMOS[1]},
        "tramo_n_test": {t: int((tramo == t).sum()) for t in TRAMOS[1]},
        "coeficientes": {"mag_sobre_mc_por_punto": float(coef_real[0]), "profundidad_por_km": float(coef_real[1]),
                         "multiplicador_por_punto": float(np.exp(coef_real[0])),
                         "alfa_utsu": float(coef_real[0] / np.log(10)),
                         "multiplicador_100km": float(np.exp(coef_real[1] * 100))},
        "importancia_permutacion": {c: {"media": float(m), "desvio": float(s)} for c, m, s in
                                    zip(X_te.columns, perm.importances_mean, perm.importances_std)
                                    if c in ("mainshock_mag", "mainshock_depth", "region_mc")},
        "particion": {"entrenamiento": int(len(X_tr)), "test": int(len(X_te)),
                      "entrena_desde": str(df.mainshock_time.iloc[0].date()),
                      "entrena_hasta": str(df.mainshock_time.iloc[corte - 1].date()),
                      "test_desde": str(df.mainshock_time.iloc[corte].date()),
                      "test_hasta": str(df.mainshock_time.iloc[-1].date())},
    }
    return modelo, X, medidas, real, pred


def comparar_modelos(df, corte):
    """Tabla de validación temporal (media y desvío del f1 macro) de todas las familias probadas."""
    X, y = df[["mainshock_mag", "mainshock_depth", "region_mc", "region", "n_prior_30d"]], df["n_aftershocks"]
    X_tr, y_tr = X.iloc[:corte], y.iloc[:corte]
    folds = list(TimeSeriesSplit(n_splits=5).split(X_tr))
    tabla = {}
    for nombre, modelo in candidatos(ALPHA, EMPUJE).items():
        notas = [f1m(a_intervalo(y_tr.iloc[v]), clone(modelo).fit(X_tr.iloc[e], y_tr.iloc[e]).predict(X_tr.iloc[v]))
                 for e, v in folds]
        tabla[nombre] = [float(np.mean(notas)), float(np.std(notas))]
    return tabla


def ajuste_hiperparametros(df, corte):
    """Las dos tablas de ajuste de la Entrega 3: alpha (empuje 0) y el trade-off del empuje (alpha elegido)."""
    X, y = df[["mainshock_mag", "mainshock_depth", "region_mc", "region", "n_prior_30d"]], df["n_aftershocks"]
    X_tr, y_tr = X.iloc[:corte], y.iloc[:corte]
    folds = list(TimeSeriesSplit(n_splits=5).split(X_tr))

    def validar(alpha, empuje):
        f1s, recalls = [], {c: [] for c in CLASES}
        for e, v in folds:
            pred = modelo_final(alpha, empuje).fit(X_tr.iloc[e], y_tr.iloc[e]).predict(X_tr.iloc[v])
            real = a_intervalo(y_tr.iloc[v])
            f1s.append(f1m(real, pred))
            for c in CLASES:
                recalls[c].append(recall_score(real, pred, labels=[c], average="macro", zero_division=0))
        return [float(np.mean(f1s)), float(np.std(f1s))] + [float(np.mean(recalls[c])) for c in CLASES]

    alphas = {str(a): validar(a, 0.0)[:2] for a in (0.001, 0.01, 0.1, 1, 10)}
    trade_off = {str(e): validar(ALPHA, e) for e in (0, 0.2, 0.3, 0.4, 0.5)}
    folds_info = [{"entrena_hasta": str(df["mainshock_time"].iloc[e[-1]].date()),
                   "valida_desde": str(df["mainshock_time"].iloc[v[0]].date()),
                   "valida_hasta": str(df["mainshock_time"].iloc[v[-1]].date()),
                   "filas_entrenamiento": int(len(e)), "filas_validacion": int(len(v))} for e, v in folds]
    return {"alpha": alphas, "trade_off_empuje": trade_off, "folds": folds_info}


def hipotesis(df):
    """Números de «Lo que encontramos»: H1 (se sostuvo) y H4 (no se sostuvo), con el dataset actual."""
    y = df["n_aftershocks"]
    tramos = pd.cut(df["mainshock_mag"], TRAMOS[0], labels=TRAMOS[1], right=False)
    media = y.mean()
    eta2 = float(sum(len(g) * (g.mean() - media) ** 2 for _, g in y.groupby(tramos, observed=True))
                 / ((y - media) ** 2).sum())
    por_tramo = y.groupby(tramos, observed=True).agg(["size", "mean"])
    t = graficos.tabla_h1(df)
    grandes = df[df["mainshock_mag"] >= 6]
    someros = grandes[grandes["mainshock_depth"] < 70]
    return {
        "h1": {"pearson": float(pearsonr(df["mainshock_mag"], y)[0]), "spearman": float(spearmanr(df["mainshock_mag"], y)[0]),
               "eta2": eta2,
               "tramos": [{"tramo": k, "secuencias": int(r["size"]), "media": float(r["mean"])} for k, r in por_tramo.iterrows()],
               "multiplicador_empirico": graficos.pendiente_h1(t), "tramos_grafico": int(len(t))},
        "h4": {"n": int(len(grandes)), "pearson": float(pearsonr(grandes["mainshock_mag"], grandes["n_aftershocks"])[0]),
               "spearman": float(spearmanr(grandes["mainshock_mag"], grandes["n_aftershocks"])[0]),
               "coef_variacion": float(grandes["n_aftershocks"].std() / grandes["n_aftershocks"].mean()),
               "minimo": int(grandes["n_aftershocks"].min()), "maximo": int(grandes["n_aftershocks"].max()),
               "someros_n": int(len(someros)),
               "someros_pearson": float(pearsonr(someros["mainshock_mag"], someros["n_aftershocks"])[0]),
               "someros_spearman": float(spearmanr(someros["mainshock_mag"], someros["n_aftershocks"])[0])},
        # la variabilidad, con sismos de la misma magnitud: los de M6,0 exactos
        "m6_exactos": {"n": int(len(m60 := df.loc[df["mainshock_mag"].round(1) == 6.0, "n_aftershocks"])),
                       "pct_cero": float((m60 == 0).mean() * 100), "maximo": int(m60.max()),
                       "por_clase": [int((pd.Series(a_intervalo(m60)) == c).sum()) for c in CLASES]},
    }


# El semáforo de la Entrega 2 (mismas medidas y mismos cortes que el notebook «Análisis Exploratorio (dataset final)»)
CORTES_SEMAFORO = {"correlacion": (0.2, 0.6), "separacion": (0.2, 0.8), "eta2": (0.05, 0.25)}
NUMERICAS_AL_PREDECIR = ["mainshock_mag", "mainshock_depth", "mainshock_lat", "mainshock_lon", "region_mc", "region_log10_eta0",
                         "n_prior_2d", "n_prior_30d", "n_prior_365d", "prior_max_mag_365d", "days_since_prior", "dist_to_border_km"]
CATEGORICAS_AL_PREDECIR = ["region", "near_border", "prior_window_truncated"]


def zona_semaforo(valor, medida):
    bajo, alto = CORTES_SEMAFORO[medida]
    v = abs(valor)
    return "rojo" if v < bajo else "verde" if v > alto else "amarillo"


def semaforo_columnas(df):
    """Las 15 columnas que existen en el momento del sismo, medidas contra las réplicas con el semáforo de la
    Entrega 2 (celdas 49 y 50 del notebook del dataset final), y el antes y el después de los movimientos de las
    dos que pasan: la magnitud (H4: partir en M6 o más, y después sólo los someros) y la profundidad (H3: partir
    en M6 o más)."""
    y = df["n_aftershocks"]

    def eta2(numerica, categoria):
        g = numerica.groupby(categoria, observed=True)
        m = numerica.mean()
        return float((g.count() * (g.mean() - m) ** 2).sum() / ((numerica - m) ** 2).sum())

    def separacion(a, b):
        return float(abs(a.mean() - b.mean()) / np.sqrt((a.std() ** 2 + b.std() ** 2) / 2))

    columnas = []
    for c in NUMERICAS_AL_PREDECIR:
        v = float(df[c].corr(y, method="spearman"))
        columnas.append({"columna": c, "medida": "spearman", "valor": v, "zona": zona_semaforo(v, "correlacion")})
    for c in CATEGORICAS_AL_PREDECIR:
        v = eta2(y, df[c])
        columnas.append({"columna": c, "medida": "η²", "valor": v, "zona": zona_semaforo(v, "eta2")})

    m6 = df[df["mainshock_mag"] >= 6]
    someros6 = m6[m6["mainshock_depth"] < 70]
    prof = df["mainshock_depth"]

    def etapa(nombre, datos, medida, valor, tipo):
        return {"etapa": nombre, "secuencias": int(len(datos)), "medida": medida, "valor": float(valor),
                "zona": zona_semaforo(valor, tipo)}

    franja = pd.cut(prof, [-1, 70, 300, 800], labels=["superficial", "intermedio", "profundo"])
    movimientos = {
        "mainshock_mag": [
            etapa("todas las secuencias", df, "spearman", df["mainshock_mag"].corr(y, method="spearman"), "correlacion"),
            etapa("sólo M6 o más", m6, "spearman",
                  m6["mainshock_mag"].corr(m6["n_aftershocks"], method="spearman"), "correlacion"),
            etapa("M6 o más y someros", someros6, "spearman",
                  someros6["mainshock_mag"].corr(someros6["n_aftershocks"], method="spearman"), "correlacion")],
        "mainshock_depth": [
            etapa("todas las secuencias", df, "separación", separacion(y[prof < 70], y[prof >= 70]), "separacion"),
            etapa("tres franjas de profundidad", df, "η²", eta2(y, franja), "eta2"),
            etapa("sólo M6 o más", m6, "separación",
                  separacion(m6.loc[m6["mainshock_depth"] < 70, "n_aftershocks"], m6.loc[m6["mainshock_depth"] >= 70, "n_aftershocks"]),
                  "separacion")],
    }
    # las réplicas medias de someros y profundos, sobre todas las secuencias y en los de M6 o más
    for e, datos in zip(movimientos["mainshock_depth"], (df, df, m6)):
        e["media_someros"] = float(datos.loc[datos["mainshock_depth"] < 70, "n_aftershocks"].mean())
        e["media_profundos"] = float(datos.loc[datos["mainshock_depth"] >= 70, "n_aftershocks"].mean())

    # el apoyo visual: de cada 100 sismos de cada grupo, cuántos dejan ninguna, pocas, moderadas o muchas réplicas
    clase = pd.Series(a_intervalo(y), index=df.index)
    somero = np.where(prof < 70, "someros", "profundos")
    tramo = pd.cut(df["mainshock_mag"], TRAMOS[0], labels=["M4–5", "M5–6", "M6–7", "M7 o más"], right=False).astype(str)
    reparto = []

    def repartir(panel, etapa_, grupos, filtro):
        d = pd.DataFrame({"grupo": grupos, "clase": clase})[filtro]
        for g, sub in d.groupby("grupo", sort=False):
            frec = sub["clase"].value_counts(normalize=True)
            for c in CLASES:
                reparto.append({"panel": panel, "etapa": etapa_, "grupo": g, "clase": c,
                                "por_cien": float(frec.get(c, 0) * 100), "sismos": int(len(sub))})

    todos = pd.Series(True, index=df.index)
    repartir("magnitud", "todas las secuencias", tramo, todos)
    repartir("profundidad", "todas las secuencias", somero, todos)
    repartir("profundidad", "sólo M6 o más", somero, df["mainshock_mag"] >= 6)
    return {"cortes": CORTES_SEMAFORO, "columnas": columnas, "movimientos": movimientos, "reparto": reparto,
            "usa_el_modelo": list(COLUMNAS[G[5]])}


# dónde va el nombre de cada región en el mapa del Cinturón de Fuego (lon, lat, de qué lado del punto)
ROTULO_REGION = {"japan": (150, 40, "left"), "philippines": (115, 19, "right"), "sumatra_java": (90, 3, "right"),
                 "mexico_ca": (-96, 26, "center"), "andes": (-79, -44, "right")}


def regiones_mapa(df):
    """Las cinco regiones con el rectángulo de su consulta a USGS (el mismo archivo que usa el pipeline) y cuántas
    secuencias aporta cada una."""
    conf = yaml.safe_load((RAIZ / "pipeline" / "include" / "sismos" / "regions.yaml").read_text(encoding="utf8"))
    cuenta = df["region"].value_counts()
    salida = []
    for r in conf["regions"]:
        lon, lat, alinear = ROTULO_REGION[r["name"]]
        salida.append({"region": r["name"], "nombre": NOMBRE_REGION[r["name"]], "secuencias": int(cuenta[r["name"]]),
                       "min_lon": r["minlongitude"], "max_lon": r["maxlongitude"],
                       "min_lat": r["minlatitude"], "max_lat": r["maxlatitude"],
                       "rotulo_lon": lon, "rotulo_lat": lat, "alinear": alinear})
    return salida


def verificar_semaforo(sem):
    """Los números del semáforo tienen que dar lo mismo que el notebook del dataset final (redondeados como ahí)."""
    ref = json.loads((RAIZ / "tests" / "reference_metrics.json").read_text(encoding="utf8"))["semaforo"]
    fallas = []
    medido = {c["columna"]: c["valor"] for c in sem["columnas"]}
    for c, v in ref["columnas"].items():
        if abs(v - medido[c]) > 0.0006:
            fallas.append(f"semáforo {c}: notebook {v} / build {medido[c]:.4f}")
    for c, valores in ref["movimientos"].items():
        for e, v in zip(sem["movimientos"][c], valores):
            if abs(v - e["valor"]) > 0.0006:
                fallas.append(f"semáforo {c} «{e['etapa']}»: notebook {v} / build {e['valor']:.4f}")
    if fallas:
        sys.exit("EL SEMÁFORO NO REPRODUCE EL NOTEBOOK DEL DATASET FINAL:\n  - " + "\n  - ".join(fallas))
    print("OK: el semáforo reproduce el notebook del dataset final")


def pasos_entrega3(df, corte):
    """Los pasos de la Entrega 3 que cuenta «El modelo» y que no son una fila de la tabla de comparación:
    por qué intervalos (celda 9), el ejemplo de Poisson (celda 39), el sesgo por región (celdas 43 y 50),
    las columnas nuevas probadas de a una (celda 54) y los otros cortes de los intervalos (celda 70)."""
    X, y = df[["mainshock_mag", "mainshock_depth", "region_mc", "region", "n_prior_30d"]], df["n_aftershocks"]
    X_tr, y_tr = X.iloc[:corte], y.iloc[:corte]
    cv = TimeSeriesSplit(n_splits=5)
    # celda 9: ¿se puede predecir el número exacto? réplicas por tramo de magnitud
    tramo = pd.cut(df["mainshock_mag"], TRAMOS[0], labels=TRAMOS[1], right=False)
    g = df.groupby(tramo, observed=True)["n_aftershocks"]
    intervalos = {t: {"sismos": int(len(v)), "media": float(v.mean()), "var_media": float(v.var() / v.mean()),
                      "minimo": int(v.min()), "maximo": int(v.max())} for t, v in g}
    # celda 39: qué contesta la primera Poisson (magnitud y profundidad crudas, alpha 1, empuje 0) para tres sismos inventados
    ejemplo = crudas(PoissonIntervalos()).fit(X_tr, y_tr)
    sismos = pd.DataFrame({"mainshock_mag": [4.5, 6.0, 7.5], "mainshock_depth": 30.0, "region_mc": 4.5})
    probs = ejemplo.predict_proba(sismos) * 100
    mu = ejemplo.named_steps["modelo"].replicas_esperadas(ejemplo.named_steps["columnas"].transform(sismos))
    ejemplo_poisson = {f"M{graficos.es(m, 1)}": {"probs": [float(x) for x in pr], "mu": float(u), "respuesta": str(r)}
                       for m, pr, u, r in zip(sismos["mainshock_mag"], probs, mu, ejemplo.predict(sismos))}
    # celda 54: columnas nuevas, de a una, con el f1 de cada fold
    probadas, por_fold = {}, {}
    for nombre, interruptores in (("base", {}), ("region", {"con_region": True}), ("previos", {"con_previos": True})):
        notas = [f1m(a_intervalo(y_tr.iloc[v]), con_columnas(**interruptores).fit(X_tr.iloc[e], y_tr.iloc[e]).predict(X_tr.iloc[v]))
                 for e, v in cv.split(X_tr)]
        probadas[nombre] = [float(np.mean(notas)), float(np.std(notas))]
        por_fold[nombre] = [float(x) for x in notas]
    # celda 70: otros cortes, con el alpha y el empuje elegidos
    cortes = {k: {m: float(v) for m, v in fila.items()} for k, fila in tabla_cortes(ALPHA, EMPUJE, X_tr, y_tr, cv).items()}
    cociente = {}
    for nombre, pipeline in (("crudo", crudas(PoissonIntervalos())), ("mag_sobre_mc", con_mc(PoissonIntervalos()))):
        r = real_sobre_predicho(esperadas_de_validacion(pipeline, X_tr, y_tr, cv), X_tr, y_tr)
        cociente[nombre] = {k: float(v) for k, v in r["real / esperadas"].items()}
    return {"columnas_probadas": probadas, "columnas_probadas_folds": por_fold, "real_sobre_esperadas": cociente,
            "intervalos_por_tramo": intervalos, "ejemplo_poisson": ejemplo_poisson, "cortes": cortes,
            "columnas_nuevas": columnas_nuevas(df, corte)}


def columnas_nuevas(df, corte):
    """Las diez columnas que la Entrega 3 no probó (el dataset con el que se empezó no las tenía), de a una y juntas,
    con el método de la celda 54 (notebook «Análisis Exploratorio (dataset final)»)."""
    tr = df.iloc[:corte].reset_index(drop=True)
    y_tr = tr["n_aftershocks"]
    cv = list(TimeSeriesSplit(n_splits=5).split(tr))
    salida = {}
    for nombre, (alpha, empuje) in {"celda54": (1.0, 0.0), "elegido": (ALPHA, EMPUJE)}.items():
        f1_base, dev_base = validar_extras([], alpha, empuje, tr, y_tr, cv)
        cols = {}
        for c in ["n_prior_30d"] + COLUMNAS_NUEVAS:
            f1, dev = validar_extras([c], alpha, empuje, tr, y_tr, cv)
            cols[c] = {"f1": float(f1.mean()), "desvio": float(f1.std()), "dif": float((f1 - f1_base).mean()),
                       "folds_mejor": int((f1 > f1_base).sum()), "dev_pct": float(((dev - dev_base) / dev_base).mean() * 100)}
        juntas = {}
        for g, extras in {"actividad_previa": ["n_prior_2d", "n_prior_365d", "days_since_prior", "prior_max_mag_365d"],
                          "las_diez": COLUMNAS_NUEVAS}.items():
            f1, dev = validar_extras(extras, alpha, empuje, tr, y_tr, cv)
            juntas[g] = {"f1": float(f1.mean()), "desvio": float(f1.std()), "dif": float((f1 - f1_base).mean()),
                         "dev_pct": float(((dev - dev_base) / dev_base).mean() * 100)}
        salida[nombre] = {"base": [float(f1_base.mean()), float(f1_base.std())], "columnas": cols, "juntas": juntas}
    # la señal de n_prior_2d, directo en los datos de entrenamiento
    tramo = pd.cut(tr["mainshock_mag"], TRAMOS[0], labels=TRAMOS[1], right=False)
    previos = pd.cut(tr["n_prior_2d"], [-1, 0, 4, 10**6], labels=["0", "1–4", "5 o más"])
    tasas = (tr.assign(tramo=tramo, previos=previos, con=tr["n_aftershocks"] > 0)
             .groupby(["tramo", "previos"], observed=True)["con"].mean() * 100)
    salida["n_prior_2d"] = {"pct_con_previos": float((tr["n_prior_2d"] > 0).mean() * 100),
                            "spearman_magnitud": float(tr["n_prior_2d"].corr(tr["mainshock_mag"], method="spearman")),
                            "con_replicas_pct": {t: {p: float(tasas[(t, p)]) for p in ["0", "1–4", "5 o más"] if (t, p) in tasas.index}
                                                 for t in ["4–5", "5–6"]}}
    return salida


def inventario_columnas(df, pasos):
    """Una fila por columna del dataset: su grupo y por qué está ahí."""
    filas = [{"columna": c, "grupo": g, "motivo": m} for g, cols in COLUMNAS.items() for c, m in cols.items()]
    t = pd.DataFrame(filas)
    if sorted(t["columna"]) != sorted(c for c in df.columns if c not in ("particion", "mag_max")):
        sys.exit("LAS COLUMNAS DEL DATASET NO COINCIDEN CON EL INVENTARIO DE build_app.py (COLUMNAS)")
    p = pasos["columnas_probadas"]
    nuevas = pasos["columnas_nuevas"]["celda54"]
    es = graficos.es
    resultado = {c: (d["f1"], d["desvio"]) for c, d in nuevas["columnas"].items()}
    resultado["region"] = tuple(p["region"])
    base = f"sin ella: {es(p['base'][0], 3)} ± {es(p['base'][1], 3)}"
    for c, (f1, sd) in resultado.items():
        fila = t["columna"] == c
        t.loc[fila, "motivo"] = t.loc[fila, "motivo"] + f" Agregándola, f1 {es(f1, 3)} ± {es(sd, 3)} ({base})."
    return t


def lugar_corto(texto):
    """«120 km SE of ?funato, Japan» -> «Ōfunato»; «2010 Maule, Chile Earthquake» -> «Maule»."""
    nombre = texto.split(" of ", 1)[1] if " of " in texto else texto
    nombre = nombre.split(",")[0].replace(" Earthquake", "").strip()
    nombre = " ".join(p for p in nombre.split() if not (p.isdigit() and len(p) == 4))
    # el pipeline trae un «?» donde iba una letra con acento; sólo se corrige el que sale rotulado
    return {"?funato": "Ōfunato", "Sumatra - Andaman Islands": "Sumatra–Andamán"}.get(nombre, nombre)


def atipicos(df):
    """Los dos grupos de casos atípicos y los cinco que se rotulan en el gráfico (elegidos por regla, no a mano)."""
    mayor = df["mag_max"] > df["mainshock_mag"] + 1e-9
    msm = df["mainshock_mag"] - df["region_mc"]
    chicos = df[(msm < 0.5) & (df["n_aftershocks"] > 10)]
    grandes = df[(df["mainshock_mag"] >= 7) & (df["n_aftershocks"] <= 2)]
    elegidos = [("mayor", df[mayor].nlargest(2, "n_aftershocks")), ("resto", df[~mayor].nlargest(2, "n_aftershocks")),
                ("profundo", grandes.sort_values(["n_aftershocks", "mainshock_depth"], ascending=[True, False]).head(1))]
    # dónde va cada rótulo: (corrimiento en magnitud, factor sobre las réplicas, lado del texto)
    lugar_texto = [(-0.4, 1.0, "right"), (0.2, 2.0, "left"), (-0.4, 3.1, "right"), (-0.3, 0.4, "right"), (0.35, 3.0, "left")]
    casos = [(rol, f) for rol, ts in elegidos for _, f in ts.iterrows()]
    filas = []
    for (rol, f), (dx, fy, lado) in zip(casos, lugar_texto):
        base = f"{lugar_corto(f.mainshock_place)} {f.mainshock_time.year} · M{graficos.es(f.mainshock_mag, 1)}"
        if rol == "mayor":
            base += f" (después, M{graficos.es(f.mag_max, 1)})"
        if rol == "profundo":
            base += f" a {graficos.es(f.mainshock_depth)} km"
        filas.append({"mag": float(f.mainshock_mag), "replicas": int(f.n_aftershocks),
                      "rotulo": f"{base} · {graficos.es(f.n_aftershocks)} réplicas",
                      "x_texto": float(f.mainshock_mag + dx), "y_texto": float(max(f.n_aftershocks, 0.4) * fy),
                      "alinear": lado})
    resumen = {"secuencias_mayor_despues": int(mayor.sum()), "pct_secuencias_mayor_despues": float(mayor.mean() * 100),
               "pct_replicas_mayor_despues": float(df.loc[mayor, "n_aftershocks"].sum() / df["n_aftershocks"].sum() * 100),
               "chicos_con_muchas": int(len(chicos)), "chicos_con_muchas_mayor_despues": int(mayor[chicos.index].sum()),
               "grandes_con_pocas": int(len(grandes)),
               "grandes_con_pocas_profundos_300": int((grandes["mainshock_depth"] > 300).sum()),
               "grandes_con_pocas_profundos_290": int((grandes["mainshock_depth"] > 290).sum())}
    return pd.DataFrame(filas), resumen


def verificar_contra_notebook(medidas, comparacion, ajuste, pasos):
    """Compara contra los números del notebook; si algo se corre más que la tolerancia, el build falla."""
    ref = json.loads((RAIZ / "tests" / "reference_metrics.json").read_text(encoding="utf8"))
    tol = ref["tolerancia"]
    fallas = []

    def comparar(ruta, esperado, obtenido, tolerancia=tol):
        if abs(esperado - obtenido) > tolerancia:
            fallas.append(f"{ruta}: notebook {esperado} / build {obtenido:.6f}")

    for bloque in ("piso", "final"):
        for k, v in ref[bloque].items():
            if k not in ("alpha", "empuje"):
                comparar(f"{bloque}.{k}", v, medidas[bloque][k])
    for k, v in ref["avisos_test"].items():
        comparar(f"avisos_test.{k}", v, medidas["avisos_test"][k], 0.06 if k == "avisados_pct" else 0)
    for c, d in ref["reporte_test"].items():
        for k, v in d.items():
            comparar(f"reporte_test.{c}.{k}", v, medidas["reporte_test"][c][k], 0 if k == "support" else tol)
    for t, v in ref["acierto_por_tramo_test"].items():
        comparar(f"tramo {t}", v, medidas["acierto_por_tramo_test"][t], 0.06)
    for k, v in ref["coeficientes"].items():
        comparar(f"coeficientes.{k}", v, medidas["coeficientes"][k], 0.0006)
    for k, v in ref["particion"].items():
        comparar(f"particion.{k}", v, medidas["particion"][k], 0)
    for nombre, valores in ref["comparacion_validacion"].items():
        if nombre.startswith("_"):
            continue
        media, desvio = valores
        # Dos modelos que NO son el elegido no reproducen exacto con la versión de scikit-learn de acá
        # (el notebook se corrió en otra); se exige cercanía y se avisa. Todo lo demás, en estricto.
        flojo = 0.03 if nombre in NO_REPRODUCEN_EXACTO else tol
        if nombre in NO_REPRODUCEN_EXACTO:
            print(f"AVISO: {nombre}: notebook {valores}, este entorno {[round(x, 3) for x in comparacion[nombre]]}")
        comparar(f"comparación {nombre} (f1)", media, comparacion[nombre][0], flojo)
        comparar(f"comparación {nombre} (desvío)", desvio, comparacion[nombre][1], flojo)
    for a, (f1, sd) in ((k, v) for k, v in ref["ajuste_alpha"].items() if not k.startswith("_")):
        comparar(f"ajuste alpha={a} f1", f1, ajuste["alpha"][a][0])
        comparar(f"ajuste alpha={a} desvío", sd, ajuste["alpha"][a][1])
    for e, valores in ((k, v) for k, v in ref["trade_off_empuje"].items() if not k.startswith("_")):
        for i, nombre in enumerate(["f1", "desvío", "recall ninguna", "recall pocas", "recall moderadas", "recall muchas"]):
            comparar(f"trade-off empuje={e} {nombre}", valores[i], ajuste["trade_off_empuje"][e][i])
    for k, (f1, sd) in ((k, v) for k, v in ref["columnas_probadas"].items() if not k.startswith("_")):
        comparar(f"columnas probadas {k} f1", f1, pasos["columnas_probadas"][k][0])
        comparar(f"columnas probadas {k} desvío", sd, pasos["columnas_probadas"][k][1])
    for k, folds in ((k, v) for k, v in ref["columnas_probadas_folds"].items() if not k.startswith("_")):
        for i, v in enumerate(folds):
            comparar(f"columnas probadas {k} fold {i + 1}", v, pasos["columnas_probadas_folds"][k][i])
    for t, d in ((k, v) for k, v in ref["intervalos_por_tramo"].items() if not k.startswith("_")):
        for k, v in d.items():
            comparar(f"intervalos {t} {k}", v, pasos["intervalos_por_tramo"][t][k], 0 if k in ("sismos", "minimo", "maximo") else 0.06)
    for m, d in ((k, v) for k, v in ref["ejemplo_poisson"].items() if not k.startswith("_")):
        for i, v in enumerate(d["probs"]):
            comparar(f"ejemplo Poisson {m} prob {i}", v, pasos["ejemplo_poisson"][m]["probs"][i], 0.06)
        comparar(f"ejemplo Poisson {m} réplicas esperadas", d["mu"], pasos["ejemplo_poisson"][m]["mu"], 0.06)
        if d["respuesta"] != pasos["ejemplo_poisson"][m]["respuesta"]:
            fallas.append(f"ejemplo Poisson {m}: notebook {d['respuesta']} / build {pasos['ejemplo_poisson'][m]['respuesta']}")
    for esquema, d in ((k, v) for k, v in ref["cortes"].items() if not k.startswith("_")):
        for k, v in d.items():
            comparar(f"cortes {esquema} {k}", v, pasos["cortes"][esquema][k])
    nuevas_ref = ref["columnas_nuevas"]
    for config in ("celda54", "elegido"):
        d, r = pasos["columnas_nuevas"][config], nuevas_ref[config]
        comparar(f"columnas nuevas {config} base f1", r["base"][0], d["base"][0])
        comparar(f"columnas nuevas {config} base desvío", r["base"][1], d["base"][1])
        for c, (f1, sd) in r["columnas"].items():
            comparar(f"columnas nuevas {config} {c} f1", f1, d["columnas"][c]["f1"])
            comparar(f"columnas nuevas {config} {c} desvío", sd, d["columnas"][c]["desvio"])
        for g, dif in r["juntas_dif"].items():
            comparar(f"columnas nuevas {config} juntas {g}", dif, d["juntas"][g]["dif"])
    comparar("n_prior_2d con previos (%)", nuevas_ref["n_prior_2d_pct"], pasos["columnas_nuevas"]["n_prior_2d"]["pct_con_previos"], 0.06)
    for version, regiones in ((k, v) for k, v in ref["real_sobre_esperadas"].items() if not k.startswith("_")):
        for r, v in regiones.items():
            comparar(f"real / esperadas {version} {r}", v, pasos["real_sobre_esperadas"][version][r], 0.006)
    if fallas:
        sys.exit("EL BUILD NO REPRODUCE EL NOTEBOOK DE LA ENTREGA 3:\n  - " + "\n  - ".join(fallas))
    print("OK: el modelo reproduce los números del notebook (tolerancia", tol, ")")


# ---------------------------------------------------------------- 3. model.json (fórmula sin sklearn)
def exportar_modelo(modelo, df, corte):
    esc, est = modelo.named_steps["escalar"], modelo.named_steps["modelo"]
    reg = est.regresion_
    tr = df.iloc[:corte]
    # el pipeline trae ruido de coma flotante (4,6 llega como 4.6000000000000005): se redondea a 6 decimales
    mc = df.groupby("region")["region_mc"].first().round(6).to_dict()
    mag_sobre = tr["mainshock_mag"] - tr["region_mc"]
    return {
        "version": "entrega3-poisson-v1", "semilla": SEMILLA, "alpha": ALPHA, "empuje": EMPUJE,
        "clases": CLASES, "cortes": modelo_core.CORTES,
        "intercepto": float(reg.intercept_), "coef": [float(c) for c in reg.coef_],
        "media": [float(m) for m in esc.mean_], "escala": [float(s) for s in esc.scale_],
        "frecuencia": [float(f) for f in est.frecuencia_],
        "mc_por_region": {k: float(v) for k, v in mc.items()},
        # lo que el modelo vio al entrenar (para avisar cuando el usuario carga algo nuevo)
        "rangos": {"magnitud": [float(tr["mainshock_mag"].min()), float(tr["mainshock_mag"].max())],
                   "profundidad": [float(tr["mainshock_depth"].min()), float(tr["mainshock_depth"].max())],
                   "mag_sobre_mc": [float(mag_sobre.min()), float(mag_sobre.max())]},
    }


# ---------------------------------------------------------------- 4. casos de paridad
def casos_golden(modelo, df, corte, mc_por_region):
    """Entradas (mag, prof, región) + lo que contesta el MODELO ORIGINAL de sklearn."""
    rng = np.random.default_rng(SEMILLA)
    regiones = sorted(mc_por_region)
    casos = []
    for r in regiones:                                                  # grilla sobre los rangos válidos
        for mag in np.round(np.arange(mc_por_region[r], 9.21, 0.1), 2):
            for prof in (0, 10, 35, 70, 150, 300, 650):
                casos.append((float(mag), float(prof), r))
    for _ in range(1000):                                               # puntos aleatorios con semilla
        r = regiones[rng.integers(len(regiones))]
        casos.append((float(np.round(rng.uniform(mc_por_region[r] - 0.5, 9.3), 3)),
                      float(np.round(rng.uniform(0, 700), 2)), r))
    for r in regiones:                                                  # bordes: justo en Mc y en los extremos
        for mag in (mc_por_region[r], mc_por_region[r] + 1e-9, 9.1, 9.5):
            for prof in (0.0, 650.655, 700.0):
                casos.append((float(mag), prof, r))
    for _, f in df.iloc[corte:].iterrows():                             # TODAS las filas del test
        casos.append((float(f.mainshock_mag), float(f.mainshock_depth), f.region))
    entrada = pd.DataFrame({"mainshock_mag": [c[0] for c in casos], "mainshock_depth": [c[1] for c in casos],
                            "region": [c[2] for c in casos]})
    entrada["region_mc"] = entrada["region"].map(mc_por_region)
    est = modelo.named_steps["modelo"]
    z = modelo[:-1].transform(entrada)
    return [{"mag": c[0], "prof": c[1], "region": c[2], "clase": str(cl), "probs": [float(p) for p in pr],
             "mu": float(m)} for c, cl, pr, m in
            zip(casos, modelo.predict(entrada), est.predict_proba(z), est.replicas_esperadas(z))]


# ---------------------------------------------------------------- 5. exportaciones
def exportar_secuencias(df, modelo, X):
    est = modelo.named_steps["modelo"]
    z = modelo[:-1].transform(X)
    P = est.predict_proba(z)
    pred = modelo.predict(X)
    cl = {c: i for i, c in enumerate(CLASES)}
    cols = {
        "id": df["cluster_id"].tolist(), "lugar": df["mainshock_place"].tolist(), "region": df["region"].tolist(),
        "fecha": df["mainshock_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ").tolist(),
        "lat": df["mainshock_lat"].round(3).tolist(), "lon": df["mainshock_lon"].round(3).tolist(),
        "mag": df["mainshock_mag"].round(2).tolist(), "mag_max": df["mag_max"].round(2).tolist(),
        "prof": df["mainshock_depth"].round(1).tolist(),
        "mc": df["region_mc"].round(1).tolist(), "replicas": df["n_aftershocks"].tolist(),
        "n_eventos": df["n_events"].tolist(),
        "real": [cl[c] for c in a_intervalo(df["n_aftershocks"])], "pred": [cl[c] for c in pred],
        "mu": np.round(est.replicas_esperadas(z), 4).tolist(),
        "probs": np.round(P, 4).tolist(), "test": (df["particion"] == "test").astype(int).tolist(),
    }
    guardar("secuencias.json", {"columnas": cols, "clases": CLASES, "n": len(df)})


def exportar_eventos():
    """Eventos de las secuencias con 2 o más sismos, para animar una secuencia en el tiempo."""
    archivos = sorted(DATOS.glob("events_*rmax=gk3_mainshock=root_seed=1.csv"))
    ev = pd.concat([pd.read_csv(f, usecols=["id", "time", "latitude", "longitude", "depth", "mag", "cluster_id"])
                    for f in archivos], ignore_index=True)
    ev["time"] = pd.to_datetime(ev["time"], utc=True)
    ev = ev.sort_values(["cluster_id", "time", "id"], kind="stable")
    ev["horas"] = (ev["time"] - ev.groupby("cluster_id")["time"].transform("min")).dt.total_seconds() / 3600
    ev = ev[ev.groupby("cluster_id")["id"].transform("size") >= 2]
    salida = {c: {"h": g["horas"].round(3).tolist(), "lat": g["latitude"].round(3).tolist(),
                  "lon": g["longitude"].round(3).tolist(), "mag": g["mag"].round(1).tolist(),
                  "prof": g["depth"].round(1).tolist()} for c, g in ev.groupby("cluster_id", sort=True)}
    guardar("eventos_secuencias.json", salida)
    return len(archivos), len(ev), len(salida)


def exportar_regiones(df, real, pred, corte):
    cfg = yaml.safe_load((RAIZ / "pipeline" / "include" / "sismos" / "regions.yaml").read_text(encoding="utf8"))
    te = df.iloc[corte:].assign(real=real, pred=pred)
    out = []
    for r in cfg["regions"]:
        t = te[te["region"] == r["name"]]
        out.append({"nombre": r["name"], "sur": r["minlatitude"], "norte": r["maxlatitude"],
                    "oeste": r["minlongitude"], "este": r["maxlongitude"],
                    "mc": float(df.loc[df.region == r["name"], "region_mc"].iloc[0]),
                    "secuencias": int((df.region == r["name"]).sum()), "secuencias_test": len(t),
                    "f1_test": f1m(t["real"], t["pred"]), "acierto_test": float((t["real"] == t["pred"]).mean()),
                    "desde": str(r["starttime"])})
    guardar("regiones.json", out)


def pasos_del_modelo(comparacion, ajuste, pasos, medidas):
    """El camino de la Entrega 3, en el orden del notebook, para el gráfico de «El modelo».
    Todos los números son los del notebook (verificados arriba contra lo que mide el build)."""
    es = graficos.es
    cociente = pasos["real_sobre_esperadas"]
    probadas = pasos["columnas_probadas"]
    recall = {e: v[3] for e, v in ajuste["trade_off_empuje"].items()}       # recall de «pocas» según el empuje
    elegido = next(k for k in comparacion if k.startswith("Poisson elegido"))
    camino, dejado = "se adoptó", "se probó y se dejó"
    filas = [
        ("Piso: contesta siempre «ninguna»", "piso (siempre ninguna)", "piso", comparacion["piso (siempre ninguna)"],
         "El número a superar: no mira ninguna columna."),
        ("1 · Regresión logística", "regresión logística", camino, comparacion["regresión logística"],
         "Primer modelo, con magnitud y profundidad: le gana al piso."),
        ("↳ con clases balanceadas", "regresión logística (balanced)", dejado, comparacion["regresión logística (balanced)"],
         "Balancear las clases bajó el f1."),
        ("2 · Poisson: cuenta las réplicas", "Poisson (mag + prof)", camino, comparacion["Poisson (mag + prof)"],
         "Estima cuántas réplicas espera y de ahí sale el intervalo: mejor que la logística."),
        ("3 · Magnitud sobre el umbral de la región", "Poisson (mag_sobre_mc + prof)", camino,
         comparacion["Poisson (mag_sobre_mc + prof)"],
         f"Casi el mismo f1, pero corrige el sesgo entre regiones: réplicas reales / esperadas en México pasa de "
         f"{es(cociente['crudo']['mexico_ca'], 2)} a {es(cociente['mag_sobre_mc']['mexico_ca'], 2)} y en Filipinas de "
         f"{es(cociente['crudo']['philippines'], 2)} a {es(cociente['mag_sobre_mc']['philippines'], 2)}."),
        ("↳ + región", "Poisson + región", dejado, probadas["region"], "No mejora el f1."),
        ("↳ + sismos de los 30 días previos", "Poisson + sismos de los 30 días previos", dejado, probadas["previos"],
         "Mejora, pero dentro del desvío: no alcanza para asegurar que sirve."),
    ]
    for nombre in ("regresión logística (mag_sobre_mc)", "regresión logística balanced (mag_sobre_mc)", "random forest",
                   "random forest (balanced)", "gradient boosting (balanced)", "Binomial Negativa (mag_sobre_mc + prof)"):
        nota = ("Termina contestando siempre «ninguna», como el piso." if nombre.startswith("Binomial")
                else "Con las mismas columnas, queda por debajo de Poisson.")
        filas.append(("↳ otras familias, mismas columnas", nombre, dejado, comparacion[nombre], nota))
    filas += [
        (f"4 · Menos regularización (alpha {es(ALPHA, 3)})", f"Poisson, alpha {es(ALPHA, 3)}", camino, ajuste["alpha"][str(ALPHA)],
         "Con dos coeficientes casi no hace falta regularizar."),
        (f"5 · Más avisos (empuje {es(EMPUJE, 1)}): el elegido", elegido, camino, comparacion[elegido],
         f"Cede un poco de f1 para detectar más réplicas: el recall de «pocas» pasa de {es(recall['0'], 2)} a "
         f"{es(recall[str(EMPUJE)], 2)}."),
        ("En el test, una sola vez (2021–2025)", "el elegido, en el test", "test", [medidas["final"]["f1_test"], None],
         "Sismos que el modelo no vio al entrenar."),
    ]
    orden = {}
    t = pd.DataFrame([{"orden": orden.setdefault(paso, len(orden)), "paso": paso, "modelo": modelo, "estado": estado,
                       "f1": v[0], "desvio": v[1], "nota": nota} for paso, modelo, estado, v, nota in filas])
    return t


NOMBRE_REGION = {"andes": "Andes", "japan": "Japón", "mexico_ca": "México y Centroamérica", "philippines": "Filipinas",
                 "sumatra_java": "Sumatra y Java"}               # los mismos de app/src/componentes/ProbaModelo.jsx


def exportar_graficos(df, modelo, medidas, comparacion, ajuste, pasos, corte, sem):
    """Especificaciones Vega-Lite de Altair + los textos que dependen de números. Devuelve los resúmenes de los
    gráficos nuevos (los números que citan los textos de la página)."""
    import altair as alt
    secuencias = json.loads((SALIDA / "secuencias.json").read_text(encoding="utf8"))
    filas = graficos.filas_explora(secuencias)
    # las 21 mil filas viajan aparte y los gráficos que las usan las piden por URL (también el globo)
    guardar("explora_filas.json", filas.to_dict(orient="records"))
    datos_url = alt.UrlData(url="data/explora_filas.json", format=alt.DataFormat(type="json"))
    carpeta = RAIZ / "app" / "public" / "specs"
    for viejo in ("modelo.json", "explora.json", "columnas_folds.json", "ejemplo_poisson.json", "variables.json"):   # reemplazados por otros gráficos
        (carpeta / viejo).unlink(missing_ok=True)
    anotaciones, resumen_atipicos = atipicos(df)
    folds = [{**f, "f1": medidas["final"]["f1_por_fold"][i]} for i, f in enumerate(ajuste["folds"])]
    specs = {
        "datos.json": graficos.grafico_datos(df),
        "columnas.json": graficos.grafico_columnas(inventario_columnas(df, pasos)),
        "cinturon.json": graficos.grafico_cinturon(
            regiones_mapa(df), json.loads((DATOS / "land-110m.json").read_text(encoding="utf8"))),
        "semaforo.json": graficos.grafico_semaforo(sem),
        "movimientos.json": graficos.grafico_movimientos(sem),
        "hallazgo.json": graficos.grafico_hallazgo(df, medidas["coeficientes"]["multiplicador_por_punto"]),
        "atipicos.json": graficos.grafico_atipicos(datos_url, anotaciones),
        "evolucion.json": graficos.grafico_evolucion(pasos_del_modelo(comparacion, ajuste, pasos, medidas)),
        "intervalos.json": graficos.grafico_intervalos(datos_url, pasos["intervalos_por_tramo"]),
        "logistica_poisson.json": graficos.grafico_logistica_poisson(comparacion, medidas["piso"]["f1_validacion"]),
        "sesgo_region.json": graficos.grafico_sesgo_region(
            pasos["real_sobre_esperadas"], df.groupby("region")["region_mc"].first().round(1).to_dict(), NOMBRE_REGION),
        "columnas_probadas.json": graficos.grafico_columnas_probadas(pasos["columnas_probadas"], pasos["columnas_nuevas"]["celda54"]),
        "cortes.json": graficos.grafico_cortes(pasos["cortes"]),
        "folds.json": graficos.grafico_folds(folds, medidas["particion"]["entrena_desde"]),
        "alpha.json": graficos.grafico_alpha(ajuste["alpha"], ALPHA),
        "empuje.json": graficos.grafico_empuje(ajuste["trade_off_empuje"], EMPUJE),
        "reporte.json": graficos.grafico_reporte(medidas["reporte_test"]),
        "confusion.json": graficos.grafico_confusion(medidas["matriz_confusion_test"]),
        "tramos.json": graficos.grafico_tramos_test(medidas["acierto_por_tramo_test"], medidas["tramo_n_test"]),
        "permutacion.json": graficos.grafico_permutacion(medidas["importancia_permutacion"], medidas["final"]["f1_test"],
                                                          medidas["piso"]["f1_test"]),
        "resultado.json": graficos.grafico_resultado(datos_url),
    }
    for nombre, chart in specs.items():
        graficos.guardar_spec(nombre, chart, carpeta)
    guardar("textos.json", graficos.textos(df, medidas, comparacion))
    extension = {"maxima_km": float(df["extent_km"].max()), "mas_de_1000_km": int((df["extent_km"] > 1000).sum())}
    return {"atipicos": resumen_atipicos, "extension": extension,
            "columnas": [{"grupo": g, "n": len(COLUMNAS[g])} for g in graficos.GRUPOS_COLUMNAS]}


def exportar_globo(df, modelo, X):
    """Datos del globo, en columnas y en el mismo orden que explora_filas.json (el detalle se lee de ahí)."""
    cl = {c: i for i, c in enumerate(CLASES)}
    regiones = [r["nombre"] for r in json.loads((SALIDA / "regiones.json").read_text(encoding="utf8"))]
    eventos = json.loads((SALIDA / "eventos_secuencias.json").read_text(encoding="utf8"))
    animable = df["cluster_id"].isin(eventos.keys())
    top = df[animable].sort_values("n_events", ascending=False).head(15)
    guardar("globo.json", {
        "regiones": regiones,
        "lat": df["mainshock_lat"].round(3).tolist(), "lon": df["mainshock_lon"].round(3).tolist(),
        "mag": df["mainshock_mag"].round(2).tolist(),
        "real": [cl[c] for c in a_intervalo(df["n_aftershocks"])], "pred": [cl[c] for c in modelo.predict(X)],
        "test": (df["particion"] == "test").astype(int).tolist(),
        "region": df["region"].map({r: i for i, r in enumerate(regiones)}).tolist(),
        "id": [c if a else "" for c, a in zip(df["cluster_id"], animable)],   # sólo las secuencias animables
        "destacadas": [{"indice": int(i), "id": r.cluster_id, "lugar": r.mainshock_place, "mag": float(r.mainshock_mag),
                        "fecha": r.mainshock_time.strftime("%Y-%m-%d"), "eventos": int(r.n_events)}
                       for i, r in top.iterrows()],
    })


def main():
    df, corte = cargar()
    modelo, X, medidas, real, pred = entrenar_y_medir(df, corte)
    medida_aca = comparar_modelos(df, corte)
    ajuste = ajuste_hiperparametros(df, corte)
    pasos = pasos_entrega3(df, corte)
    verificar_contra_notebook(medidas, medida_aca, ajuste, pasos)
    # la app muestra la tabla del notebook; lo medido en este entorno queda aparte
    ref = json.loads((RAIZ / "tests" / "reference_metrics.json").read_text(encoding="utf8"))["comparacion_validacion"]
    comparacion = {k: v for k, v in ref.items() if not k.startswith("_")}

    fm = exportar_modelo(modelo, df, corte)
    # la fórmula escrita a mano tiene que dar lo mismo que sklearn
    golden = casos_golden(modelo, df, corte, fm["mc_por_region"])
    resultados = [modelo_core.predecir(fm, g["mag"], g["prof"], g["region"]) for g in golden]
    mal = [g for g, r in zip(golden, resultados) if r["clase"] != g["clase"]]
    dif = max(abs(a - b) for g, r in zip(golden, resultados) for a, b in zip(r["probs"], g["probs"]))
    print(f"Paridad modelo_core vs sklearn: {len(golden)} casos, {len(mal)} con distinta clase, "
          f"diferencia máxima de probabilidad {dif:.2e}")
    if mal or dif > 1e-9:
        sys.exit("LA FÓRMULA NO COINCIDE CON EL MODELO DEL NOTEBOOK")

    guardar("model.json", fm)
    sem = semaforo_columnas(df)
    verificar_semaforo(sem)
    guardar("hipotesis.json", {**hipotesis(df), "semaforo": sem})
    guardar("paleta.json", {"clases": CLASES, "color_clase": COLOR_CLASE, "color_particion": COLOR_PARTICION,
                         "color_principal": COLOR_PRINCIPAL, "color_mayor": COLOR_MAYOR})
    guardar("pasos_filtrado.json", json.loads((DATOS / "filter_steps.json").read_text(encoding="utf8")))
    exportar_secuencias(df, modelo, X)
    resumenes = exportar_graficos(df, modelo, medidas, comparacion, ajuste, pasos, corte, sem)
    guardar("metricas.json", {**medidas, "comparacion_validacion": comparacion, "comparacion_medida_en_build": medida_aca,
                              "ajuste": ajuste, **pasos, **resumenes})
    exportar_regiones(df, real, pred, corte)
    n_arch, n_ev, n_seq = exportar_eventos()
    exportar_globo(df, modelo, X)
    guardar("golden.json", golden, RAIZ / "tests")
    print(f"Listo. {len(df)} secuencias; {n_ev} eventos en {n_seq} secuencias animables ({n_arch} archivos de región).")


if __name__ == "__main__":
    main()
