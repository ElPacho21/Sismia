"""Genera todo lo que consume la aplicación Sisimia a partir de los datos del pipeline.

    python build_app.py

1. Lee el dataset de secuencias y los eventos que publica el pipeline (carpeta data/).
2. Entrena el modelo de la Entrega 3 con la misma semilla y lo compara contra
   tests/reference_metrics.json (los números del notebook). Si no coincide, FALLA.
3. Calcula la predicción de cada secuencia, marcando si es de entrenamiento o de test.
4. Escribe en app/public/data/: secuencias, eventos (para animar), regiones, paleta,
   model.json, métricas y pasos de filtrado. Y en tests/golden.json los casos de paridad.

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
from palette import CLASES, COLOR_CLASE, COLOR_PARTICION
import graficos
from referencia_sklearn import a_intervalo, candidatos, modelo_final

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "data"
SALIDA = RAIZ / "app" / "public" / "data"
SEMILLA = 42
ALPHA, EMPUJE = 0.001, 0.4            # elegidos en la Entrega 3 (celdas 62 y 68)
ARCHIVO = "clusters_combined_5regions_rmax=gk3_mainshock=root_seed=1.csv"
NO_REPRODUCEN_EXACTO = {"random forest (balanced)", "gradient boosting (balanced)"}
TRAMOS = ([4, 5, 6, 7, 10], ["4–5", "5–6", "6–7", "7 o más"])


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
    }


def verificar_contra_notebook(medidas, comparacion, ajuste):
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
        "mag": df["mainshock_mag"].round(2).tolist(), "prof": df["mainshock_depth"].round(1).tolist(),
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


def exportar_graficos(df, medidas, comparacion):
    """Especificaciones Vega-Lite de Altair + los textos que dependen de números."""
    import altair as alt
    secuencias = json.loads((SALIDA / "secuencias.json").read_text(encoding="utf8"))
    regiones = pd.DataFrame(json.loads((SALIDA / "regiones.json").read_text(encoding="utf8")))
    filas = graficos.filas_explora(secuencias)
    # los datos del mapa viajan aparte (21 mil filas) y el gráfico los pide por URL
    guardar("explora_filas.json", filas.to_dict(orient="records"))
    datos_url = alt.UrlData(url="data/explora_filas.json", format=alt.DataFormat(type="json"))
    carpeta = RAIZ / "app" / "public" / "specs"
    graficos.guardar_spec("datos.json", graficos.grafico_datos(df), carpeta)
    graficos.guardar_spec("hallazgo.json", graficos.grafico_hallazgo(df), carpeta)
    graficos.guardar_spec("modelo.json", graficos.grafico_modelo(comparacion), carpeta)
    graficos.guardar_spec("explora.json", graficos.grafico_explora(datos_url, regiones, sorted(regiones["nombre"])), carpeta)
    guardar("textos.json", graficos.textos(df, medidas, comparacion))


def main():
    df, corte = cargar()
    modelo, X, medidas, real, pred = entrenar_y_medir(df, corte)
    medida_aca = comparar_modelos(df, corte)
    ajuste = ajuste_hiperparametros(df, corte)
    verificar_contra_notebook(medidas, medida_aca, ajuste)
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
    guardar("metricas.json", {**medidas, "comparacion_validacion": comparacion, "comparacion_medida_en_build": medida_aca, "ajuste": ajuste})
    guardar("hipotesis.json", hipotesis(df))
    guardar("paleta.json", {"clases": CLASES, "color_clase": COLOR_CLASE, "color_particion": COLOR_PARTICION})
    guardar("pasos_filtrado.json", json.loads((DATOS / "filter_steps.json").read_text(encoding="utf8")))
    exportar_secuencias(df, modelo, X)
    exportar_graficos(df, medidas, comparacion)
    exportar_regiones(df, real, pred, corte)
    n_arch, n_ev, n_seq = exportar_eventos()
    guardar("golden.json", golden, RAIZ / "tests")
    print(f"Listo. {len(df)} secuencias; {n_ev} eventos en {n_seq} secuencias animables ({n_arch} archivos de región).")


if __name__ == "__main__":
    main()
