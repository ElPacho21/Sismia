"""Tests de la API: misma respuesta que el modelo del notebook y manejo de casos raros."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app

RAIZ = Path(__file__).resolve().parent.parent
cliente = TestClient(app)
golden = json.loads((RAIZ / "tests" / "golden.json").read_text(encoding="utf8"))
casos_avisos = json.loads((RAIZ / "tests" / "casos_avisos.json").read_text(encoding="utf8"))


def predecir(magnitud, profundidad, region):
    return cliente.post("/api/predict", json={"magnitud": magnitud, "profundidad": profundidad, "region": region})


def test_health():
    r = cliente.get("/api/health")
    assert r.status_code == 200 and r.json()["estado"] == "ok"


def test_misma_clase_y_probabilidades_que_el_modelo_del_notebook_en_todos_los_golden():
    """Los 6.992 casos del modelo original (grilla, aleatorios, bordes y todo el test)."""
    clases_distintas, dif = 0, 0.0
    for g in golden:
        # el golden tiene casos extremos (mag hasta 9,5) que la API acepta; sólo se evitan los imposibles
        r = predecir(g["mag"], g["prof"], g["region"])
        assert r.status_code == 200, (g, r.text)
        cuerpo = r.json()
        clases_distintas += cuerpo["clase"] != g["clase"]
        dif = max(dif, *(abs(a - b) for a, b in zip(cuerpo["probabilidades"].values(), g["probs"])))
    assert clases_distintas == 0
    assert dif <= 1e-9


def test_la_respuesta_trae_todo_lo_que_la_pagina_muestra():
    cuerpo = predecir(6.0, 30, "japan").json()
    assert set(cuerpo) >= {"clase", "clase_mas_probable", "el_empuje_cambio_la_clase", "probabilidades",
                           "replicas_esperadas", "region", "mc_region", "avisos", "version_modelo", "origen"}
    assert cuerpo["origen"] == "servidor"
    assert sum(cuerpo["probabilidades"].values()) == pytest.approx(1.0)
    assert cuerpo["mc_region"] == 4.6


def test_se_avisa_cuando_el_empuje_cambia_la_clase():
    hay = [g for g in golden if g["clase"] != ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"][
        g["probs"].index(max(g["probs"]))]]
    assert hay, "tiene que haber casos donde el empuje mueva la clase"
    g = hay[0]
    cuerpo = predecir(g["mag"], g["prof"], g["region"]).json()
    assert cuerpo["el_empuje_cambio_la_clase"] is True
    assert cuerpo["clase"] != cuerpo["clase_mas_probable"]


@pytest.mark.parametrize("c", casos_avisos, ids=[c["nombre"] for c in casos_avisos])
def test_avisos_de_casos_que_el_modelo_no_vio(c):
    r = predecir(c["magnitud"], c["profundidad"], c["region"])
    assert r.status_code == 200                      # se permite y se avisa
    assert [a["codigo"] for a in r.json()["avisos"]] == c["codigos"]


@pytest.mark.parametrize("cuerpo", [
    {"magnitud": "mucha", "profundidad": 30, "region": "japan"},        # no es un número
    {"magnitud": "nan", "profundidad": 30, "region": "japan"},          # NaN
    {"magnitud": "inf", "profundidad": 30, "region": "japan"},          # infinito
    {"magnitud": 15, "profundidad": 30, "region": "japan"},             # no existe una magnitud 15
    {"magnitud": -1, "profundidad": 30, "region": "japan"},
    {"magnitud": 5.5, "profundidad": -10, "region": "japan"},           # profundidad negativa
    {"magnitud": 5.5, "profundidad": 5000, "region": "japan"},          # más profundo que el planeta
    {"magnitud": 5.5, "profundidad": 30, "region": "atlantida"},        # región desconocida
    {"magnitud": 5.5, "profundidad": 30},                               # falta la región
    {},
])
def test_se_rechaza_lo_que_no_tiene_sentido(cuerpo):
    r = cliente.post("/api/predict", json=cuerpo)
    assert r.status_code == 422


def test_cors_permite_llamar_desde_la_pagina():
    r = cliente.options("/api/predict", headers={"Origin": "https://sisimia.vercel.app",
                                              "Access-Control-Request-Method": "POST"})
    assert r.headers["access-control-allow-origin"] in ("*", "https://sisimia.vercel.app")
