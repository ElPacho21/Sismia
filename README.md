# Sisimia

**Cuando ocurre un sismo, ¿cuántas réplicas podemos esperar?**

Proyecto integrador de Ciencia de Datos (UTN FRM). A partir del catálogo sísmico de USGS se arma un dataset de
**21.292 secuencias** (un sismo principal y sus réplicas) de cinco regiones de subducción, 2003–2025. Un modelo de
Poisson por intervalos estima si habrá **ninguna, pocas, moderadas o muchas** réplicas. Sirve para **priorizar qué
sismos vigilar, no para emitir alertas**: en el test (sismos que no vio al entrenar) saca un f1 macro de **0,50**
contra **0,24** del piso, y avisa de 6 de cada 10 secuencias que tuvieron réplicas, con muchas falsas alarmas.

**Aplicación publicada:** https://sisimia.vercel.app

La aplicación cuenta el proyecto entero (los datos, lo que encontramos, el modelo) y deja explorarlo y probarlo.
Este archivo explica cómo está armado el repositorio y cómo regenerar todo.

---

## Cómo está armado

El proyecto es una cadena: **pipeline → análisis → modelo → aplicación**. Cada eslabón consume lo que produce el anterior.

```
USGS ──► pipeline/ (Airflow) ──► data/*.csv ──► notebooks/ (análisis y modelo) ─┐
                                      │                                         │ los números del notebook son
                                      ▼                                         │ la referencia
                              build_app.py ◄── tests/reference_metrics.json ◄───┘
                                      │
                 ┌────────────────────┼─────────────────────┐
                 ▼                    ▼                     ▼
        app/public/data/      app/public/specs/        tests/golden.json
        (datos, model.json)   (gráficos Altair)        (casos de paridad)
                 │                    │
                 ▼                    ▼
          app/ (React) ◄──────────────┘          api/ (FastAPI)  ──  sólo calcula «Probá el modelo»
                 └──────────── Vercel: https://sisimia.vercel.app ────────────┘
```

| Carpeta o archivo | Qué es |
|---|---|
| `pipeline/` | **Entrega 1.** Pipeline de Airflow que baja el catálogo de USGS y arma el dataset. Se levanta con [`pipeline/README.md`](pipeline/README.md). |
| `docs/PIPELINE_METODO.md` | Qué hace cada paso del pipeline y por qué (método de Zaliapin y Ben-Zion). |
| `notebooks/` | **Entregas 2 y 3.** El análisis exploratorio y el modelado. `Entrega 3-Definitivo.ipynb` (en la raíz) es el notebook final del modelo. |
| `data/` | Los CSV que produce el pipeline y que consume el build (ver «Datos»). |
| `build_app.py` | **Entrega 4.** Toma los datos, entrena el modelo con la misma semilla, **verifica que da lo del notebook** y genera todo lo que consume la aplicación. |
| `referencia_sklearn.py` | El modelo del notebook tal cual (scikit-learn). Es la referencia contra la que se verifican la API y el JS. |
| `modelo_core.py` | El mismo modelo escrito como fórmula, sin scikit-learn. Lo usa la API. |
| `graficos.py` | Los gráficos, con **Altair**. Los títulos y los números de la portada salen de los datos. |
| `palette.py` | La paleta de colores, definida una sola vez. |
| `api/` | FastAPI: `GET /api/health` y `POST /api/predict`. |
| `app/` | La aplicación en React (Vite). `app/src/modelo.js` es la fórmula del modelo en JavaScript. `app/src/globo/` es el globo 3D (three). |
| `tests/` | Tests de Python (`pytest`) y los archivos de referencia. |
| `app/tests/`, `app/e2e/` | Tests de JavaScript (`vitest`) y de punta a punta (`Playwright`). |
| `docs/GRAFICOS.md` | Cada gráfico, componente por componente (datos, mapeo, marca, transformaciones, escalas, por qué). |
| `docs/DECISIONES_DISENO.md` | Qué cambió en cada gráfico entre versiones y por qué. |
| `vercel.json`, `.vercelignore` | Configuración del despliegue. |

## Cómo se publica la aplicación

La consigna lista dos formas (página HTML en GitHub Pages o Streamlit). Este proyecto usa una tercera, que se apoya en la primera:

- **El sitio es estático** (React compilado). Las predicciones para explorar se calculan **antes** (`build_app.py`) y viajan con los datos.
  Lo que muestran el tallo, Explorá y el globo **no depende de ningún servidor**.
- **«Probá el modelo»** llama a una API de FastAPI en el mismo dominio (`/api/predict`). Si no responde en 4 segundos, o devuelve
  un error, **la página calcula lo mismo en el navegador** con los coeficientes de `model.json` (`app/src/modelo.js`) y lo avisa
  («Calculado en tu navegador»). Esa es la condición de la consigna para el HTML: la fórmula tiene que poder escribirse dentro de la página.
- Al cargar, la página llama a `/api/health` para despertar la función (arranque en frío).

Cómo llega el modelo a la aplicación: el elegido de la Entrega 3 (regresión de Poisson con `mag_sobre_mc` y profundidad,
`alpha = 0,001`, `empuje = 0,4`) es una **fórmula cerrada**, así que se exporta a `app/public/data/model.json` (coeficientes, media y
desvío del escalado, Mc por región, frecuencias y rangos del entrenamiento). La API y el JS implementan la misma fórmula y se verifican contra el
modelo original de scikit-learn en **6.992 casos** (grilla, puntos aleatorios con semilla, bordes y las 4.259 filas del test): misma clase en el
100 % y probabilidades con diferencia menor a 1e-9.

---

## Cómo correr todo

Requisitos: **Python 3.14** (el que se usó; las versiones de `requirements-build.txt` están fijadas) y **Node 20.19 o superior, o 22.12 o superior** (probado con 24; lo exige Vite). Sobre Windows; en Linux o Mac cambian las rutas del entorno virtual.

### 1. Entorno de Python

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-build.txt
```

> `requirements.txt` (el de la raíz) **no** es para esto: tiene sólo FastAPI y es el que lee Vercel para la API. Las dependencias del build y de los tests están en `requirements-build.txt`.

### 2. Datos

El build lee de `data/`:

| Archivo | De dónde sale |
|---|---|
| `clusters_combined_5regions_rmax=gk3_mainshock=root_seed=1.csv` | Salida del pipeline: `pipeline/include/output/detector_replicas_api/delivery/clusters_combined_5regions-<hash>_rmax=gk3_mainshock=root_seed=1.csv`, **sin el `-<hash>`** en el nombre. |
| `events_*_rmax=gk3_mainshock=root_seed=1.csv` (cinco, una por región) | La misma carpeta `delivery/`, copiados tal cual. Alimentan la animación de secuencias del globo. |
| `filter_steps.json` | Filas que quedan en cada paso del pipeline. Se genera con `python scripts/count_filter_steps.py <carpeta detector_replicas_api>` (necesita las salidas `bronze/` y `silver/` del pipeline, que no se versionan por su peso). |

Regenerar desde una copia limpia del repositorio, con un entorno virgen, da **archivos idénticos** a los versionados. Los datos que están en el repositorio son los de la corrida del **29 de octubre de 2026** (catálogo hasta el 31/12/2025).

### 3. Generar la aplicación

```powershell
.venv\Scripts\python build_app.py
```

Qué hace, en orden:

1. Lee los datos y parte cronológicamente (80 % entrenamiento, 20 % test).
2. Entrena el modelo con la semilla 42 y lo **compara contra `tests/reference_metrics.json`**, que tiene los números del notebook de la Entrega 3
   (piso, validación, test, tablas de ajuste de `alpha` y de `empuje`, comparación de modelos). **Si algo se corre más que la tolerancia (0,0006), el build falla** y dice qué.
3. Verifica que la fórmula de `modelo_core.py` da lo mismo que scikit-learn en los casos de paridad.
4. Escribe en `app/public/data/` y `app/public/specs/` todo lo que consume la página, y `tests/golden.json`.

Es **determinista**: correrlo dos veces da archivos idénticos (hay un test que lo comprueba).

### 4. Ver la aplicación en tu máquina

```powershell
.venv\Scripts\python -m uvicorn api.main:app --port 8000      # la API (en una terminal)
cd app; npm install; npm run dev                             # el sitio en http://localhost:5173 (en otra)
```

En desarrollo, Vite redirige `/api` a `localhost:8000`.

### 5. Tests

```powershell
.venv\Scripts\python -m pytest tests            # 36: build, paridad con sklearn, gráficos, API
cd app; npm test                                # 26: fórmula en JS (paridad) y geometría del globo
cd app; npm run e2e                             # 19: Playwright con Edge; levanta la API y el sitio compilado solos
cd app; $env:BASE_URL="https://sisimia.vercel.app"; npm run e2e   # los mismos, contra la URL pública
```

### 6. Publicar

Con la CLI de Vercel ya logueada: `vercel deploy --prod` desde la raíz. `vercel.json` compila el sitio (`app/`) y expone la API como función
de Python (`api/index.py`). Detalles que conviene saber:

- Vercel construye con **lo que hay en `app/public/data/` y `app/public/specs/`**: hay que correr `build_app.py` y versionar esos archivos antes de publicar.
- `.vercelignore` deja afuera datos, notebooks y pipeline. Sus patrones van **anclados a la raíz** (`/data`): sin la barra, `data` también excluiría `app/public/data/`.
- Variables de entorno (opcionales, no hay secretos): `ORIGENES_PERMITIDOS` (orígenes CORS de la API, por defecto cualquiera) y `MODELO_JSON` (ruta alternativa a `model.json`).
- El repositorio de GitHub está conectado al proyecto de Vercel: un `push` a `main` también dispara un despliegue.

---

## Si los datos se actualizan

Corriendo el pipeline de nuevo y copiando los CSV a `data/` (paso 2), `python build_app.py` regenera la aplicación. Pero **el build va a fallar a propósito**:
compara contra los números del notebook de la Entrega 3, y con datos nuevos esos números cambian. El procedimiento es:

1. Volver a correr el notebook de la Entrega 3 con los datos nuevos.
2. Actualizar `tests/reference_metrics.json` con lo que dé el notebook (es una decisión deliberada, no un parche: la aplicación tiene que coincidir con el notebook).
3. Correr `build_app.py` y los tests.
4. Revisar a mano lo que está escrito en el código y **no** sale de los datos:
   - la fecha de la corrida y las fechas del catálogo en `app/src/componentes/ComoDatos.jsx`;
   - las cifras fijas de los tests (`tests/test_build.py` espera 87.103, 37.513 y 21.292; `app/e2e/sisimia.spec.js` espera 87.103 y 37.513);
   - la explicación de los errores en `app/src/componentes/ComoModelo.jsx`, que se escribió mirando casos concretos del test de ese momento.

---

## Cosas que conviene saber (límites y decisiones)

- **Una tabla no se reproduce exacto.** En la comparación de modelos, `random forest (balanced)` (0,302 contra 0,325 del notebook) y `gradient boosting (balanced)` no
  coinciden con la versión de scikit-learn de este entorno. La causa probable es la versión (el notebook se corrió en otra), pero no está verificada.
  La aplicación muestra **los números del notebook**; los medidos acá quedan en `metricas.json` (`comparacion_medida_en_build`) y `build_app.py` avisa al correr. Ninguno es el modelo elegido.
- **Un único modelo para las cinco regiones.** La región entra sólo a través de `mag_sobre_mc = magnitud − Mc de la región`. El resultado «por región» es el del test de ese modelo en esa región.
- **Casos fuera de lo que el modelo vio:** se calculan y **se avisa** (magnitud menor al Mc de la región, magnitud o profundidad fuera del rango de entrenamiento).
  Sólo se rechaza lo que no tiene sentido: texto, NaN, magnitud fuera de 0–10, profundidad fuera de 0–800 km, región inexistente.
- **El globo es un extra.** No reemplaza nada de lo obligatorio y, si el navegador no tiene WebGL, se avisa y el resto sigue funcionando. Los gráficos obligatorios son todos de Altair; el globo es three.
- **Probado sólo en Edge** (Chromium) y desde una sola computadora; Firefox y otras máquinas quedan por verificar antes de la exposición.
- Algunos nombres de lugar traen un `?` donde iba una letra con acento (por ejemplo «?funato»): viene del pipeline, no de la aplicación.
- Los notebooks y el pipeline de las Entregas 1 a 3 no se modificaron para esta entrega.
