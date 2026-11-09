"""Tests de la Fase 1: el build produce lo que dice el notebook y es determinista."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "app" / "public" / "data"
sys.path.insert(0, str(RAIZ))

import modelo_core  # noqa: E402


def leer(nombre):
    return json.loads((SALIDA / nombre).read_text(encoding="utf8"))


def test_metricas_coinciden_con_el_notebook():
    ref = json.loads((RAIZ / "tests" / "reference_metrics.json").read_text(encoding="utf8"))
    m = leer("metricas.json")
    assert m["final"]["f1_test"] == pytest.approx(ref["final"]["f1_test"], abs=ref["tolerancia"])
    assert m["final"]["accuracy_test"] == pytest.approx(ref["final"]["accuracy_test"], abs=ref["tolerancia"])
    assert m["final"]["f1_validacion"] == pytest.approx(ref["final"]["f1_validacion"], abs=ref["tolerancia"])
    assert m["piso"]["f1_test"] == pytest.approx(ref["piso"]["f1_test"], abs=ref["tolerancia"])


def test_paridad_formula_vs_sklearn_en_todos_los_golden():
    modelo, golden = leer("model.json"), json.loads((RAIZ / "tests" / "golden.json").read_text(encoding="utf8"))
    assert len(golden) > 4259                        # incluye todas las filas del test
    clases_mal, dif = 0, 0.0
    for g in golden:
        r = modelo_core.predecir(modelo, g["mag"], g["prof"], g["region"])
        clases_mal += r["clase"] != g["clase"]
        dif = max(dif, max(abs(a - b) for a, b in zip(r["probs"], g["probs"])))
    assert clases_mal == 0
    assert dif <= 1e-9


def test_cada_secuencia_lleva_su_particion_y_el_test_es_el_20_por_ciento_mas_nuevo():
    s = leer("secuencias.json")["columnas"]
    n_test = sum(s["test"])
    assert len(s["id"]) == 21292 and n_test == 4259
    fechas_train = [f for f, t in zip(s["fecha"], s["test"]) if not t]
    fechas_test = [f for f, t in zip(s["fecha"], s["test"]) if t]
    assert max(fechas_train) <= min(fechas_test)


def test_los_pasos_de_filtrado_cierran():
    pasos = leer("pasos_filtrado.json")
    assert sum(p["descargados_usgs"] for p in pasos) == 87103
    assert sum(p["sobre_mc"] for p in pasos) == sum(p["eventos_publicados"] for p in pasos) == 37513
    assert sum(p["secuencias"] for p in pasos) == 21292


def test_avisos_para_casos_fuera_de_lo_visto():
    modelo = leer("model.json")
    assert modelo_core.avisos(modelo, 5.5, 30, "japan") == []
    assert modelo_core.avisos(modelo, 3.0, 30, "japan")             # menor que el Mc de la región
    assert modelo_core.avisos(modelo, 5.5, 900, "japan")            # más profundo que todo lo visto


def test_el_build_es_determinista():
    archivos = sorted(SALIDA.glob("*.json")) + [RAIZ / "tests" / "golden.json"]
    antes = {a.name: hashlib.sha256(a.read_bytes()).hexdigest() for a in archivos}
    subprocess.run([sys.executable, str(RAIZ / "build_app.py")], check=True, cwd=RAIZ, capture_output=True)
    despues = {a.name: hashlib.sha256(a.read_bytes()).hexdigest() for a in archivos}
    assert antes == despues
