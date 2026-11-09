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
