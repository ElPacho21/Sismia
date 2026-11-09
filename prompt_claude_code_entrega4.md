# Prompt para Claude Code — Entrega 4: {{NOMBRE_APP}}

> **Antes de pegarlo:** reemplazá `{{NOMBRE_APP}}` y completá la sección 2.3 (correcciones del docente). Dejá también la consigna original en el repo como `docs/ConsignaEntrega4.txt`: es la fuente de verdad si algo de este prompt la contradice.

---

## 0. Reglas de trabajo (innegociables)

1. **Empezá en modo plan.** La Fase 0 es solo lectura: no modifica nada del repo.
2. **No inventes nada.** Todo número, hallazgo, columna, zona, hiperparámetro, nombre de archivo o resultado sale del repo, de los notebooks o de mí. Si no está, no lo suplas: preguntame.
3. **Ante cualquier duda, preguntame antes de avanzar.** Si un requerimiento está poco claro, es ambiguo o admite dos interpretaciones razonables, hacé una pregunta concreta con opciones y esperá mi respuesta. No asumas.
4. **Una fase por vez, con compuerta.** Al terminar cada fase: resumí qué hiciste, qué verificaste y cómo, qué falta y qué decisiones necesito de mí. Después parás hasta que te diga «dale».
5. **No toques el pipeline, el análisis ni el modelo de las Entregas 1–3**, salvo lo indicado en 2.3. Antes de cualquier cambio, hacé una *reference run* y confirmá que reproducís los números del notebook de la Entrega 3. Si no coinciden, frená y avisame.
6. **No hagas commit, push ni deploy** sin que te lo pida.
7. **La evaluación es individual:** cualquier integrante del grupo tiene que poder explicar cualquier parte del código. Código simple, nombres claros, comentarios en español donde no sea obvio, cero magia.
8. **Verificá contra documentación vigente** (Vercel, vega-embed, la librería 3D que elijas) en lugar de confiar en tu memoria.

---

## 1. Contexto

Es el proyecto integrador de Ciencia de Datos (UTN-FRM). La aplicación es la **Entrega 4** y es la misma que se expone el **25 de noviembre**. Hay que publicarla en una URL pública que abra desde cualquier navegador, sin instalar nada.

Lo siguiente es lo que sé de segunda mano sobre las entregas anteriores. **Verificalo contra el repo; si el repo dice otra cosa, manda el repo y avisame.**

- Detector de réplicas sísmicas sobre datos de USGS, con un pipeline en Airflow y el método de vecino más cercano de Zaliapin & Ben-Zion para separar réplicas.
- Salidas del pipeline: un CSV por secuencia (`clusters_*.csv`) y uno por sismo (`eventos_*.csv`).
- Entrega 3: el modelo elegido sería una regresión de Poisson (clase propia con intervalos, hiperparámetros `alpha` y `empuje`) que clasifica cada secuencia en 4 clases de cantidad de réplicas, con `mag_sobre_mc` (magnitud sobre la magnitud de completitud de cada región) y profundidad. Métrica f1 macro, piso con `DummyClassifier`, partición cronológica y `TimeSeriesSplit`.
- La Entrega 3 entrena por **zonas/regiones**, cada una con su Mc.

---

## 2. Lo que es obligatorio (consigna) y lo que es extra

### 2.1 Obligatorio — «la copa de martini»

La aplicación entera es una copa: primero el **tallo** (lo guía el autor), después la **copa** (la maneja el usuario).

| Parte | Sección | Qué tiene | Cierra |
|---|---|---|---|
| Portada | El proyecto | La pregunta, la idea central en **una oración con sujeto y verbo**, y **tres números** que la sostienen | La definición |
| Tallo | Los datos | Título que **afirma** algo de los datos + gráfico que lo muestra | Entrega 1 |
| Tallo | Lo que encontramos | Título que afirma el hallazgo principal del análisis + gráfico | Entrega 2 |
| Tallo | El modelo | Título que afirma qué logró el modelo + gráfico | Entrega 3 |
| Copa | Explorá | Los datos con el resultado del modelo, para recorrerlos | Todas |
| Copa | Probá el modelo | El usuario carga un caso nuevo y ve qué dice el modelo | Entrega 3 |

**Cada sección del tallo** tiene: (a) un título que afirma, no que describe; (b) un gráfico que lo prueba y unas pocas líneas que dicen qué mirar; (c) un desplegable **«Cómo lo sabemos»**, **cerrado por defecto**, con la evidencia técnica.

Contenido mínimo de cada «Cómo lo sabemos»:
- **Los datos:** de dónde salen y cómo se obtienen (pipeline y fecha de los datos); qué es una fila; qué se filtró, paso por paso, con cuántas filas quedaron en cada paso y por qué; qué columnas se descartaron por fuga.
- **Lo que encontramos:** una hipótesis que se sostuvo y una que no, cada una con su número; cómo se construyó el gráfico si hubo alguna transformación no obvia.
- **El modelo:** la métrica y por qué; el piso; cómo se armó la validación; la tabla de comparación con media y desvío; el ajuste del elegido; el resultado en test y dónde se equivoca; en qué se apoya.

**Copa — Explorá:** (1) un *panorama* con todos los datos en una vista; (2) *zoom y filtro*: al menos dos controles (menú, deslizador, selección) que achiquen el universo y **cambien el gráfico**; (3) *detalle a pedido* (mouse encima o selección) que incluya **lo que dijo el modelo** sobre ese caso.

**Copa — Probá el modelo:** el usuario carga los valores de un caso nuevo y ve la predicción **con su probabilidad**. El usuario no puede cargar valores que el modelo nunca vio, o la app le avisa cuando lo hace.

**Gráficos (reglas duras):**
- Hechos con **Altair**; cada uno debe poder leerse componente por componente: datos, mapeo, marca, transformaciones, escalas.
- Colores, categorías y escalas significan **lo mismo en toda la app** (si el azul es una clase en el tallo, es esa clase en la copa y en el globo).
- La copa es interactiva; el tallo puede serlo, pero cada gráfico del tallo tiene que decir lo suyo sin que nadie lo toque.

**Proyecto integrado:**
- `build_app.py` (o nombre equivalente): toma los datos que produce el pipeline, carga o entrena el modelo **con la misma semilla** y genera la aplicación. Si los datos se actualizan, correrlo de nuevo actualiza la app.
- Repo en GitHub con el código del pipeline, del análisis y del modelo, y un **README** con el que otra persona pueda regenerar todo.
- **Lo que muestra la app coincide con lo que da el notebook.**

### 2.2 Extra — decisiones ya tomadas por el grupo

**Arquitectura**
- **Frontend: React** (build estático). **Backend: FastAPI**. Despliegue en **Vercel** (verificá en la documentación vigente cómo se despliegan juntos y cuáles son los límites).
- Esto es una tercera forma de publicar, distinta de las dos que lista la consigna (HTML en GitHub Pages / Streamlit). Se documenta y se justifica en el README y en la exposición; vamos a mencionárselo al docente.
- **Reparto de trabajo:**
  - Los datos, las especificaciones de los gráficos y todo lo que se muestra **viajan estáticos con el frontend** (los genera `build_app.py`). El tallo, Explorá y el globo **no dependen del API**.
  - FastAPI **solo calcula las predicciones de «Probá el modelo»**.
  - **Fallback en JS:** si el API no responde en un tiempo límite, el frontend calcula lo mismo en el navegador con los coeficientes exportados. La interfaz debe mostrar siempre de dónde salió la predicción («calculado en el servidor» / «calculado en tu navegador»).
  - Al cargar la página, el frontend hace un ping a `/health` para despertar la función (arranque en frío).
- **Paridad obligatoria:** el JS, el API y el modelo original del notebook tienen que dar el **mismo resultado**. Detalle en 4.3.
- **Altair → React:** Altair corre en Python. `build_app.py` serializa cada gráfico como especificación Vega-Lite (JSON) y React lo dibuja con `vega-embed`. Los controles de Explorá se declaran como **parámetros de Altair** (con nombre) para que la pregunta «¿qué componente del gráfico toca este control?» se conteste mirando el código Python. React puede leer y escribir esos parámetros a través de la API de la vista de Vega para sincronizar con el globo.

**El globo 3D (extra, no reemplaza nada de lo obligatorio)**
- **Rol:** (a) *vista adicional dentro de la copa* y (b) *selector de zona/evento* que alimenta Explorá y Probá el modelo (los gráficos siguen siendo Altair).
- **Qué muestra** (verificá que cada dato exista en el repo; lo que no exista, **frená y preguntame**):
  1. Las **zonas entrenadas** en la Entrega 3, resaltadas, con su resultado por zona (por ejemplo f1, Mc, cantidad de secuencias, lo que el repo permita).
  2. **Cada sismo/secuencia como punto**, con color según clase real vs. clase predicha.
  3. **Animación de una secuencia:** elegís un mainshock y se reproduce en el tiempo con sus réplicas.
  4. **Probar el modelo desde el globo:** click en una zona, cargar magnitud y profundidad, ver clase y probabilidad.
- **Estética:** oscura, de datos / sci-fi. Es el tipo de demo que se hace cuando sale un modelo nuevo de IA. La sorpresa tiene que venir de la ejecución, no de efectos sueltos.
- **Principio de diseño:** un efecto sin dato es decoración. Cada efecto visual codifica algo (el tamaño de un pulso = magnitud, el color = clase, la distancia temporal = tiempo de la secuencia).
- **Colores:** la paleta de clases se define **una sola vez** (en Python, la usa `build_app.py`) y se exporta a un `palette.json`. La usan las escalas de Altair y el globo. Si cambia, cambia en todos lados.

### 2.3 Correcciones del docente en la Entrega 3

La consigna exige que lo marcado esté resuelto en la app o explicado por qué no se pudo.

```
{{PEGAR ACÁ lo que marcó el docente en la Entrega 3, textual}}
```

Si queda vacío, **preguntame** antes de la Fase 1.

---

## 3. Qué NO hacer (las tres formas de perder los 25 minutos)

- **El tablero sin historia:** diez filtros, seis gráficos y ninguna conclusión. Cada pantalla tiene que tener un mensaje.
- **El notebook con otra ropa:** no copies celdas del análisis una debajo de la otra. Lo técnico va en los «Cómo lo sabemos», no en el tallo.
- **La app que solo corre en una notebook:** tiene que andar desde una URL pública, en una computadora que no sea la nuestra.

Además:
- **No escribas por tu cuenta** la oración central, los títulos del tallo ni los tres números de la portada. Calculalos desde los datos y proponeme **2–3 candidatos** de cada uno, con el número que los sostiene, y esperá mi elección. Los títulos con números se generan **programáticamente** a partir de los valores calculados, para que no se desfasen.
- **No inventes un historial de diseño.** La consigna pregunta «qué tenía la primera versión de ese gráfico y por qué no funcionaba». Llevá un `docs/DECISIONES_DISENO.md` donde registres cada cambio *real* de cada gráfico (v1 → v2, motivo). Si un gráfico no cambió, no se anota nada.
- No uses gráficos que no sean Altair en las secciones obligatorias.
- No cargues nada desde CDNs ni servicios externos en tiempo de ejecución (texturas, fuentes, librerías). Todo *self-hosted* y empaquetado: el día de la entrega puede fallar el Wi-Fi. Las texturas deben ser de dominio público o propias.
- No subas secretos, tokens ni datos que no deban ser públicos.

---

## 4. Especificaciones técnicas

### 4.1 Estructura propuesta (adaptala a la estructura real después de la Fase 0)

```
build_app.py            # genera todo lo que consume la app
app/                    # frontend React
  public/data/          # datos estáticos generados
  public/specs/         # specs Vega-Lite generadas desde Altair
  public/model/         # model.json (coeficientes, escalado, umbrales, rangos de entrenamiento)
api/                    # FastAPI
tests/                  # build, API y paridad
docs/                   # consigna, decisiones de diseño, guía de defensa
README.md
```

No reorganices lo que ya existe en el repo: integrá `app/`, `api/` y `build_app.py` sin romper las rutas actuales.

### 4.2 `build_app.py`

1. Lee los datos de la capa final del pipeline (verificá cuáles son y sus columnas).
2. Carga o entrena el modelo **con la misma semilla** y reproduce las métricas de la Entrega 3. Compará contra un `reference_metrics.json` con los valores del notebook. **Si no coinciden dentro de una tolerancia explícita, el build falla.**
3. Calcula las predicciones para Explorá. **Cada fila lleva marcada su partición (train/test)**, para que la app nunca presente como resultado honesto lo que es de entrenamiento. Qué filas se muestran por defecto lo decidimos en la Fase 0.
4. Exporta: datos, specs Altair, `palette.json`, `model.json`, geometría/centroides de las zonas, vectores de prueba (ver 4.3).
5. Es idempotente: correrlo dos veces da lo mismo.

### 4.3 Paridad del modelo (JS ↔ API ↔ notebook)

- Primero **leé la clase del modelo** (cómo calcula la media, cómo convierte a clases, qué hace `empuje`, si existe probabilidad por clase). **Si el modelo no produce probabilidades o no es una fórmula cerrada, frená y preguntame** (la consigna pide probabilidad si es clasificación, y el fallback en JS solo es posible con fórmula cerrada).
- `model.json` guarda todo lo necesario para recalcular sin pickle: coeficientes, media y desvío del escalado, Mc por zona, umbrales, `empuje`, rangos de entrenamiento por zona.
- API y JS implementan la misma fórmula desde `model.json`. El modelo original del notebook es la **referencia** contra la que se verifican ambos.
- **Vectores de prueba (*golden*):** generados por el modelo original: grilla sobre los rangos válidos, puntos aleatorios con semilla, casos de borde (en los umbrales de las clases, en el límite de los rangos) y **todas las filas del test**. Criterio: **misma clase en el 100 % de los casos y probabilidades con diferencia ≤ 1e-9**. Si hay un caso que no cumple, no se oculta: se reporta.
- Tests: `pytest` para API y build; `vitest` (o equivalente) para el JS.

### 4.4 FastAPI

- `GET /health` y `POST /predict` con validación (pydantic).
- Respuesta de `/predict`: clase, probabilidades, zona, advertencias de fuera de rango, versión del modelo, origen del cálculo.
- Qué hace con casos raros: valores fuera del rango visto, magnitud por debajo del Mc de la zona, zona desconocida, valores no numéricos. **Preguntame** cuál de estas dos políticas prefiero, antes de implementarla: (a) bloquear la carga, o (b) permitirla y avisar claramente que es extrapolación.
- CORS configurado si frontend y API van en orígenes distintos.
- Dependencias fijadas; el bundle tiene que entrar en los límites de Vercel (verificalos en la documentación vigente).

### 4.5 Altair

Usá lo que se vio en la Unidad 4: tipos explícitos (`:Q`, `:O`, `:N`, `:T`), escalas declaradas (log donde corresponda, `zero` según marca), canales reutilizables, transformaciones dentro del gráfico cuando sirvan, `alt.data_transformers.disable_max_rows()` y pasar **solo las columnas que se usan** (cuidá el peso de cada spec). Para cada gráfico dejá en `docs/GRAFICOS.md` una tabla componente por componente (datos, mapeo por canal, marca, transformaciones, escalas, y por qué).

Los controles de Explorá y la selección de zona/evento se declaran como **parámetros con nombre** en Altair, para poder sincronizarlos con el globo.

### 4.6 Frontend y globo

- Diseño de cada sección del tallo = decisión del grupo. **Antes de implementar, presentame 2 propuestas de layout/narrativa del tallo** y esperá mi elección.
- Librería 3D: proponé en el plan, con pros, contras y peso en KB, entre `react-three-fiber` + `three`, `globe.gl` y `deck.gl`. Yo apruebo.
- Rendimiento: miles de puntos con instanciado/GPU, objetivo fluido en una notebook común; carga diferida del globo; que el resto de la app abra rápido sin esperarlo.
- Resiliencia: detección de WebGL con mensaje de fallback; `prefers-reduced-motion` respetado; navegación por teclado en los controles.
- Momentos de impacto a proponer en el plan (no implementar sin aprobación): entrada cinematográfica al globo, pulsos en los epicentros, vuelo de cámara al elegir una zona, línea de tiempo con reproducción de una secuencia, panel sincronizado con Explorá.
- Idioma de la interfaz: español. Prioridad: Chrome, Edge y Firefox de escritorio. No inviertas esfuerzo en móvil salvo que yo lo pida.

### 4.7 Despliegue

- Repo en GitHub conectado a Vercel. Verificá que la **URL de producción sea pública** (sin pantalla de login ni protección que la vuelva privada).
- Variables de entorno documentadas, sin secretos en el repo.
- Antes de dar por terminado: abrir la URL en un navegador limpio y desde otra computadora, probar el arranque en frío del API y el fallback apagando el API.

---

## 5. Fases (cada una termina con compuerta)

**Fase 0 — Auditoría y plan (solo lectura).** Informe con: estructura real del repo; datos disponibles (columnas, zonas, si hay coordenadas por zona y por sismo); el modelo (clase, features, umbrales, `empuje`, si hay probabilidades); notebooks y dónde está cada número que muestra la Entrega 3; reference run; riesgos; plan ajustado a lo real; y **todas las preguntas abiertas**. Preguntas que seguro vas a tener que hacerme si el repo no las responde:
- ¿Qué filas se muestran en Explorá (todo / solo test) y cómo se distingue train de test?
- ¿Qué política para casos fuera de rango (4.4)?
- ¿Cuáles 3 números y cuál oración central (2–3 candidatos de cada uno)?
- ¿Qué hipótesis (una sostenida y una no) van en «Lo que encontramos»?
- Lo marcado por el docente (2.3), si no lo completé.
- Cualquier dato que pediría el globo y no exista.

**Fase 1 — Contrato de datos y `build_app.py`.** Exportaciones, `reference_metrics.json`, vectores de prueba, `palette.json`. Tests del build.

**Fase 2 — Gráficos Altair.** Portada, 3 gráficos del tallo, Explorá. `docs/GRAFICOS.md`. Cada gráfico dice lo suyo sin tocarlo.

**Fase 3 — Modelo en API y en JS, con paridad.** FastAPI + implementación JS + todos los tests de paridad en verde.

**Fase 4 — App obligatoria completa, sin globo.** Portada, tallo con «Cómo lo sabemos», Explorá y Probá el modelo. **Deploy en Vercel y URL pública verificada.** Con esto, la entrega ya está cubierta.

**Fase 5 — Globo 3D.** Integración con Explorá y Probá el modelo, paleta compartida, fallback sin WebGL.

**Fase 6 — Pulido y QA.** Transiciones, accesibilidad, tests *end-to-end* (Playwright o equivalente: recorrer cada sección, abrir cada «Cómo lo sabemos», mover los controles, probar el modelo, apagar el API y verificar el fallback), sin errores en consola.

**Fase 7 — Documentación y defensa.** README que permita regenerar todo; `docs/DECISIONES_DISENO.md`; `docs/GUIA_DEFENSA.md` que ubique en el repo cada cosa que pide la consigna que sepamos explicar: por qué cada título afirma lo que afirma y qué número lo sostiene, un gráfico componente por componente, una decisión de diseño cambiada, qué componente toca cada control, cómo llega el modelo a la app y qué pasa con un caso raro, cómo se regenera si cambian los datos. Checklist final de entrega.

---

## 6. Criterio de «terminado»

- La URL pública abre y funciona sin errores durante la entrega.
- Portada con la oración y tres números; tres secciones del tallo, cada una con título que afirma, gráfico que lo prueba y «Cómo lo sabemos» completo.
- Copa: panorama, al menos dos controles que cambian el gráfico, detalle a pedido con el resultado del modelo, y Probá el modelo con aviso ante valores nunca vistos.
- Todos los gráficos obligatorios en Altair y legibles componente por componente.
- Lo que muestra la app coincide con el notebook (tests en verde).
- README con el que otra persona regenera todo.
- Lo marcado por el docente en la Entrega 3 resuelto o explicado.

**Empezá ahora por la Fase 0.**
