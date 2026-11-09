"""Cuenta las filas que quedan en cada paso del pipeline, por región.

Se corre UNA vez contra la carpeta de salidas del pipeline (bronze y silver no
viajan en este repo por su peso) y deja data/filter_steps.json, que lee build_app.py.

Uso: python scripts/count_filter_steps.py <carpeta detector_replicas_api>
"""
import json
import sys
from pathlib import Path

import pandas as pd

salidas = Path(sys.argv[1])
raiz = Path(__file__).resolve().parent.parent
clusters = pd.read_csv(raiz / "data" / "clusters_combined_5regions_rmax=gk3_mainshock=root_seed=1.csv")
mc_por_region = clusters.groupby("region")["region_mc"].first().round(1)

# nombre del archivo del pipeline que corresponde a cada región (ver pipeline/include/sismos/regions.yaml)
CONSULTAS = {
    "andes": "2008-01-01_endtime=2026-01-01_minmagnitude=3.5_bbox=-55,-18,-76,-53",
    "japan": "2003-01-01_endtime=2026-01-01_minmagnitude=4_bbox=30,46,128,148",
    "philippines": "2003-01-01_endtime=2026-01-01_minmagnitude=4_bbox=5,20,117,128",
    "sumatra_java": "2003-01-01_endtime=2026-01-01_minmagnitude=4_bbox=-11,14,92,115",
    "mexico_ca": "2003-01-01_endtime=2026-01-01_minmagnitude=3.5_bbox=8,21,-110,-81",
}
pasos = []
for region, consulta in CONSULTAS.items():
    bronze = pd.read_csv(salidas / "bronze" / f"earthquake_starttime={consulta}.csv.gz")
    silver = pd.read_parquet(salidas / "silver" / f"earthquake_starttime={consulta}.parquet")
    eventos = pd.read_csv(salidas / "delivery" / f"events_earthquake_starttime={consulta}_rmax=gk3_mainshock=root_seed=1.csv")
    pasos.append({"region": region, "mc": float(mc_por_region[region]),
                  "descargados_usgs": len(bronze), "silver_limpios": len(silver),
                  "sobre_mc": int((silver["mag"] >= mc_por_region[region] - 1e-9).sum()),
                  "eventos_publicados": len(eventos),
                  "secuencias": int((clusters["region"] == region).sum())})
(raiz / "data" / "filter_steps.json").write_text(json.dumps(pasos, indent=1), encoding="utf8")
print(pd.DataFrame(pasos))
