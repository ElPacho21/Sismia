"""El modelo tal cual está en el notebook de la Entrega 3 (scikit-learn). Es la REFERENCIA:
la API y el JS se verifican contra esto. No se modifica la lógica, sólo se copia."""
import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.base import BaseEstimator, ClassifierMixin, TransformerMixin
from sklearn.linear_model import PoissonRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from modelo_core import CORTES
from palette import CLASES


def a_intervalo(conteo):
    """Pasa un conteo de réplicas a su intervalo."""
    return np.array(CLASES)[np.searchsorted(CORTES, np.asarray(conteo), side="left")]


class PoissonIntervalos(BaseEstimator, ClassifierMixin):
    def __init__(self, alpha=1.0, empuje=0.0):
        self.alpha = alpha
        self.empuje = empuje

    def fit(self, X, y):
        self.regresion_ = PoissonRegressor(alpha=self.alpha, max_iter=1000).fit(X, y)
        self.classes_ = np.array(CLASES)
        intervalos = a_intervalo(y)
        self.frecuencia_ = np.array([(intervalos == c).mean() for c in CLASES])
        return self

    def replicas_esperadas(self, X):
        return self.regresion_.predict(X)

    def predict_proba(self, X):
        mu = self.replicas_esperadas(X)
        acumulada = [poisson.cdf(k, mu) for k in CORTES]
        return np.column_stack([acumulada[0]] +
                               [acumulada[i] - acumulada[i - 1] for i in range(1, len(CORTES))] +
                               [1 - acumulada[-1]])

    def predict(self, X):
        P = self.predict_proba(X) / np.maximum(self.frecuencia_, 1e-6) ** self.empuje
        return self.classes_[P.argmax(axis=1)]


class MagSobreMc(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        return pd.DataFrame({"mag_sobre_mc": X["mainshock_mag"] - X["region_mc"],
                             "profundidad": X["mainshock_depth"]}, index=X.index)


def modelo_final(alpha, empuje):
    return Pipeline([("columnas", MagSobreMc()), ("escalar", StandardScaler()),
                     ("modelo", PoissonIntervalos(alpha=alpha, empuje=empuje))])


# ---------------------------------------------------------------- comparación de familias de modelos
# (celdas 28-57 del notebook). Todos reciben el conteo; la nota se pone sobre el intervalo.
from scipy.stats import nbinom                                    # noqa: E402
from sklearn.compose import ColumnTransformer                      # noqa: E402
from sklearn.base import clone                                     # noqa: E402
from sklearn.dummy import DummyClassifier                          # noqa: E402
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier  # noqa: E402
from sklearn.linear_model import LogisticRegression                # noqa: E402

SEMILLA = 42


class Clasificador(BaseEstimator, ClassifierMixin):
    """Un clasificador común: recibe el conteo, lo pasa a intervalo y aprende el intervalo."""
    def __init__(self, modelo=None):
        self.modelo = modelo

    def fit(self, X, y):
        self.modelo_ = clone(self.modelo).fit(X, a_intervalo(y))
        self.classes_ = self.modelo_.classes_
        return self

    def predict(self, X):
        return self.modelo_.predict(X)


class BinomialNegativaIntervalos(PoissonIntervalos):
    def fit(self, X, y):
        super().fit(X, y)
        mu = np.maximum(self.replicas_esperadas(X), 1e-6)
        disp = np.mean(((y - mu) ** 2 - mu) / (mu ** 2))
        self.disp_ = max(disp, 1e-4)
        return self

    def predict_proba(self, X):
        mu = np.maximum(self.replicas_esperadas(X), 1e-6)
        n = 1.0 / self.disp_
        p = n / (n + mu)
        acumulada = [nbinom.cdf(k, n, p) for k in CORTES]
        return np.column_stack([acumulada[0]] +
                               [acumulada[i] - acumulada[i - 1] for i in range(1, len(CORTES))] +
                               [1 - acumulada[-1]])


def crudas(modelo):
    """Magnitud y profundidad tal como vienen, escaladas, y el modelo."""
    return Pipeline([("columnas", ColumnTransformer([("escalar", StandardScaler(),
                                                     ["mainshock_mag", "mainshock_depth"])])),
                     ("modelo", modelo)])


def con_mc(modelo):
    return Pipeline([("columnas", MagSobreMc()), ("escalar", StandardScaler()), ("modelo", modelo)])


def candidatos(alpha, empuje):
    """Los modelos de la tabla de comparación, en el orden del notebook."""
    return {
        "piso (siempre ninguna)": crudas(Clasificador(DummyClassifier(strategy="most_frequent"))),
        "regresión logística": crudas(Clasificador(LogisticRegression(max_iter=3000, random_state=SEMILLA))),
        "regresión logística (balanced)": crudas(Clasificador(
            LogisticRegression(max_iter=3000, class_weight="balanced", random_state=SEMILLA))),
        "Poisson (mag + prof)": crudas(PoissonIntervalos()),
        "Poisson (mag_sobre_mc + prof)": con_mc(PoissonIntervalos()),
        "regresión logística (mag_sobre_mc)": con_mc(Clasificador(
            LogisticRegression(max_iter=3000, random_state=SEMILLA))),
        "regresión logística balanced (mag_sobre_mc)": con_mc(Clasificador(
            LogisticRegression(max_iter=3000, class_weight="balanced", random_state=SEMILLA))),
        "random forest": con_mc(Clasificador(RandomForestClassifier(
            n_estimators=200, min_samples_leaf=20, random_state=SEMILLA, n_jobs=-1))),
        "random forest (balanced)": con_mc(Clasificador(RandomForestClassifier(
            n_estimators=200, min_samples_leaf=20, class_weight="balanced", random_state=SEMILLA, n_jobs=-1))),
        "gradient boosting (balanced)": con_mc(Clasificador(HistGradientBoostingClassifier(
            min_samples_leaf=20, class_weight="balanced", random_state=SEMILLA))),
        "Binomial Negativa (mag_sobre_mc + prof)": con_mc(BinomialNegativaIntervalos()),
        "Poisson elegido (alpha=0,001, empuje=0,4)": modelo_final(alpha, empuje),
    }


# ---------------------------------------------------------------- columnas nuevas y sesgo por región
# (celdas 43, 50 y 54 del notebook). Se copian sin cambiar la lógica.
class ColumnasCandidatas(BaseEstimator, TransformerMixin):
    """mag_sobre_mc + profundidad (siempre), con interruptores para probar columnas nuevas."""
    def __init__(self, con_region=False, con_previos=False):
        self.con_region = con_region
        self.con_previos = con_previos

    def fit(self, X, y=None):
        self.regiones_ = sorted(X["region"].unique())          # se aprende sólo del train
        return self

    def transform(self, X):
        salida = pd.DataFrame({"mag_sobre_mc": X["mainshock_mag"] - X["region_mc"],
                               "profundidad": X["mainshock_depth"]}, index=X.index)
        if self.con_region:
            for r in self.regiones_[1:]:                          # una columna 0/1 por región
                salida[f"region_{r}"] = (X["region"] == r).astype(float)
        if self.con_previos:
            salida["log_previos_30d"] = np.log1p(X["n_prior_30d"])  # sismos en los 30 días anteriores
        return salida


def con_columnas(**interruptores):
    return Pipeline([("columnas", ColumnasCandidatas(**interruptores)), ("escalar", StandardScaler()),
                     ("modelo", PoissonIntervalos())])


def esperadas_de_validacion(pipeline, X_train, y_train, cv):
    """Réplicas esperadas para cada sismo, calculadas cuando ese sismo estaba en validación."""
    esperadas = pd.Series(np.nan, index=X_train.index)
    for entrena, valida in cv.split(X_train):
        pipeline.fit(X_train.iloc[entrena], y_train.iloc[entrena])
        columnas = pipeline[:-1].transform(X_train.iloc[valida])          # todo menos el modelo
        esperadas.iloc[valida] = pipeline[-1].replicas_esperadas(columnas)
    return esperadas.dropna()


def real_sobre_predicho(esperadas, X_train, y_train):
    t = pd.DataFrame({"real": y_train.loc[esperadas.index], "esperadas": esperadas,
                      "region": X_train.loc[esperadas.index, "region"],
                      "Mc": X_train.loc[esperadas.index, "region_mc"],
                      "mag": X_train.loc[esperadas.index, "mainshock_mag"]})
    t = t[t["mag"] < 6.5]          # sin los megasismos, que en una suma tapan todo lo demás
    r = t.groupby("region").agg(Mc=("Mc", "first"), real=("real", "sum"), esperadas=("esperadas", "sum"))
    r["real / esperadas"] = r["real"] / r["esperadas"]
    return r.sort_values("Mc")


# ---------------------------------------------------------------- otros cortes de los intervalos
# (celda 70 del notebook). Se copian sin cambiar la lógica.
ESQUEMAS = {"0 | 1–5 | 6+": [0, 5],
            "0 | 1–10 | 11+": [0, 10],
            "0 | 1–2 | 3–10 | 11+ (el elegido)": [0, 2, 10],
            "0 | 1 | 2–5 | 6+": [0, 1, 5],
            "0 | 1 | 2–5 | 6–20 | 21+": [0, 1, 5, 20]}


class PoissonCortes(PoissonIntervalos):
    """La misma PoissonIntervalos, pero con otros cortes."""
    def __init__(self, alpha=1.0, empuje=0.0, cortes=(0, 2, 10), clases=None):
        super().__init__(alpha, empuje)
        self.cortes = cortes
        self.clases = clases

    def fit(self, X, y):
        self.regresion_ = PoissonRegressor(alpha=self.alpha, max_iter=1000).fit(X, y)
        self.classes_ = np.array(self.clases)
        inter = np.array(self.clases)[np.searchsorted(self.cortes, np.asarray(y), side="left")]
        self.frecuencia_ = np.array([(inter == c).mean() for c in self.clases])
        return self

    def predict_proba(self, X):
        mu = self.replicas_esperadas(X)
        acum = [poisson.cdf(k, mu) for k in self.cortes]
        return np.column_stack([acum[0]] + [acum[i] - acum[i - 1] for i in range(1, len(self.cortes))] + [1 - acum[-1]])


class ClasificadorCortes(BaseEstimator, ClassifierMixin):
    def __init__(self, modelo=None, intervalo=None):
        self.modelo = modelo
        self.intervalo = intervalo

    def fit(self, X, y):
        self.modelo_ = clone(self.modelo).fit(X, self.intervalo(y))
        return self

    def predict(self, X):
        return self.modelo_.predict(X)


def f1_con_cortes(cortes, pipeline_de, X_train, y_train, cv):
    from sklearn.metrics import f1_score
    clases = [str(i) for i in range(len(cortes) + 1)]
    intervalo = lambda n: np.array(clases)[np.searchsorted(cortes, np.asarray(n), side="left")]  # noqa: E731
    notas = []
    for e, v in cv.split(X_train):
        pred = pipeline_de(cortes, clases, intervalo).fit(X_train.iloc[e], y_train.iloc[e]).predict(X_train.iloc[v])
        notas.append(f1_score(intervalo(y_train.iloc[v]), pred, average="macro", labels=clases))
    return np.mean(notas)


def tabla_cortes(alpha, empuje, X_train, y_train, cv):
    filas = {}
    for nombre, cortes in ESQUEMAS.items():
        filas[nombre] = {
            "intervalos": len(cortes) + 1,
            "piso": f1_con_cortes(cortes, lambda c, cl, it: con_mc(ClasificadorCortes(DummyClassifier(strategy="most_frequent"), it)),
                                  X_train, y_train, cv),
            "logística (balanced)": f1_con_cortes(cortes, lambda c, cl, it: con_mc(ClasificadorCortes(
                LogisticRegression(max_iter=3000, class_weight="balanced"), it)), X_train, y_train, cv),
            "Poisson": f1_con_cortes(cortes, lambda c, cl, it: con_mc(PoissonCortes(alpha=alpha, empuje=empuje, cortes=c, clases=cl)),
                                     X_train, y_train, cv),
        }
    return filas
