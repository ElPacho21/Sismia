"""API de Sisimia: sólo calcula las predicciones de «Probá el modelo».

    uvicorn api.main:app --reload

  GET  /health   despierta la función (arranque en frío) y dice qué modelo hay cargado
  POST /predict  {magnitud, profundidad, region} -> clase, probabilidades, avisos

La fórmula está en modelo_core.py (la misma que implementa el JS del navegador).
Política para casos raros: se PERMITE calcular y se AVISA; sólo se rechaza lo que no
tiene sentido (texto, NaN, magnitud fuera de 0–10, profundidad negativa, región inexistente).
"""
import json
import os
import sys
from math import isfinite
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import modelo_core  # noqa: E402

RUTA_MODELO = Path(os.environ.get("MODELO_JSON", RAIZ / "app" / "public" / "data" / "model.json"))
MODELO = json.loads(RUTA_MODELO.read_text(encoding="utf8"))
# desde qué sitios se puede llamar a la API (la página en Vercel); por defecto, cualquiera: no hay datos privados
ORIGENES = os.environ.get("ORIGENES_PERMITIDOS", "*").split(",")

app = FastAPI(title="Sisimia", version=MODELO["version"])
app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["GET", "POST"], allow_headers=["*"])


class Caso(BaseModel):
    magnitud: float
    profundidad: float
    region: str

    @field_validator("magnitud")
    @classmethod
    def magnitud_posible(cls, v):
        if not isfinite(v) or not 0 <= v <= 10:
            raise ValueError("La magnitud tiene que ser un número entre 0 y 10.")
        return v

    @field_validator("profundidad")
    @classmethod
    def profundidad_posible(cls, v):
        if not isfinite(v) or not 0 <= v <= 800:
            raise ValueError("La profundidad tiene que ser un número entre 0 y 800 km.")
        return v


@app.get("/health")
def health():
    return {"estado": "ok", "modelo": MODELO["version"]}


@app.post("/predict")
def predict(caso: Caso):
    if caso.region not in MODELO["mc_por_region"]:
        raise HTTPException(422, f"Región desconocida: {caso.region!r}. Opciones: {sorted(MODELO['mc_por_region'])}.")
    r = modelo_core.predecir(MODELO, caso.magnitud, caso.profundidad, caso.region)
    return {
        "clase": r["clase"],
        "clase_mas_probable": r["clase_mas_probable"],
        "el_empuje_cambio_la_clase": r["clase"] != r["clase_mas_probable"],
        "probabilidades": dict(zip(MODELO["clases"], r["probs"])),
        "replicas_esperadas": r["mu"],
        "region": caso.region,
        "mc_region": MODELO["mc_por_region"][caso.region],
        "avisos": modelo_core.avisos(MODELO, caso.magnitud, caso.profundidad, caso.region),
        "version_modelo": MODELO["version"],
        "origen": "servidor",
    }
