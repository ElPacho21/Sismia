"""Paridad de la API con el modelo del notebook: tests/golden.json lo genera build_app.py con el modelo original (sklearn)."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from api.main import app

RAIZ = Path(__file__).resolve().parent.parent
cliente = TestClient(app)
golden = json.loads((RAIZ / "tests" / "golden.json").read_text(encoding="utf8"))


def test_misma_clase_y_probabilidades_que_el_modelo_del_notebook_en_todos_los_golden():
    """Los 6.992 casos del modelo original (grilla, aleatorios, bordes y todo el test)."""
    clases_distintas, dif = 0, 0.0
    for g in golden:
        # el golden tiene casos extremos (mag hasta 9,5) que la API acepta; sólo se evitan los imposibles
        r = cliente.post("/api/predict", json={"magnitud": g["mag"], "profundidad": g["prof"], "region": g["region"]})
        assert r.status_code == 200, (g, r.text)
        cuerpo = r.json()
        clases_distintas += cuerpo["clase"] != g["clase"]
        dif = max(dif, *(abs(a - b) for a, b in zip(cuerpo["probabilidades"].values(), g["probs"])))
    assert clases_distintas == 0
    assert dif <= 1e-9
