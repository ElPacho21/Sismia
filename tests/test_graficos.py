"""Tests de la Fase 2: las especificaciones Altair compilan y la app cuenta lo mismo en todos lados."""
import json
from pathlib import Path

import pytest
import vl_convert as vlc

RAIZ = Path(__file__).resolve().parent.parent
SPECS = RAIZ / "app" / "public" / "specs"
DATOS = RAIZ / "app" / "public" / "data"
NOMBRES = ["datos", "hallazgo", "modelo", "explora"]


def spec(nombre):
    return json.loads((SPECS / f"{nombre}.json").read_text(encoding="utf8"))


def todos_los_valores(obj, clave):
    """Todos los valores que una clave toma en cualquier parte de la especificación."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == clave:
                yield v
            yield from todos_los_valores(v, clave)
    elif isinstance(obj, list):
        for v in obj:
            yield from todos_los_valores(v, clave)


@pytest.mark.parametrize("nombre", NOMBRES)
def test_la_especificacion_compila_a_vega(nombre):
    assert vlc.vegalite_to_vega(spec(nombre))["marks"]


def test_la_escala_de_color_de_las_clases_es_la_misma_en_todos_los_graficos():
    paleta = json.loads((DATOS / "paleta.json").read_text(encoding="utf8"))
    for nombre in ("datos", "explora"):
        escalas = [e for e in todos_los_valores(spec(nombre), "scale") if isinstance(e, dict) and "domain" in e
                   and e["domain"] == paleta["clases"]]
        assert escalas, f"{nombre} no usa la escala de clases"
        assert all(e["range"] == paleta["color_clase"] for e in escalas)


def test_explora_tiene_al_menos_dos_controles_con_nombre_que_filtran():
    s = spec("explora")
    controles = {p["name"] for p in s["params"] if "bind" in p}
    assert {"region", "mag_min", "ver", "color_por"} <= controles
    filtros = [f for f in todos_los_valores(s, "filter") if isinstance(f, str)]
    assert any("mag_min" in f and "region" in f for f in filtros)


def test_explora_muestra_el_resultado_del_modelo_en_el_detalle_y_marca_la_particion():
    s = spec("explora")
    campos = {t["field"] for ts in todos_los_valores(s, "tooltip") for t in ts if "field" in t}
    assert {"pred", "real", "p_ninguna", "p_muchas", "particion"} <= campos


def test_los_titulos_salen_de_los_numeros_calculados():
    t = json.loads((DATOS / "textos.json").read_text(encoding="utf8"))
    m = json.loads((DATOS / "metricas.json").read_text(encoding="utf8"))
    f1 = f"{m['final']['f1_test']:.2f}".replace(".", ",")
    assert f1 in t["titulo_modelo"] and f1 in t["numeros"][0]["valor"]
    assert "21.292" in t["titulo_datos"]
    assert t["numeros"][1]["valor"].startswith("59,7")
    assert t["numeros"][2]["valor"].endswith("7,6")
    assert "6 de cada 10" in t["aclaracion"] and "3 de cada 4" in t["aclaracion"]
