# Gráficos de Sisimia, componente por componente

Todos hechos con Altair en `graficos.py` y exportados por `build_app.py` como especificaciones
Vega-Lite en `app/public/specs/`. **Regla de color:** el color siempre es la *clase de réplicas*
(escala `ESCALA_CLASE`, definida una vez en `palette.py`); lo que no es una clase va en grises o
en el azul verdoso `#0b7285`, que significa sólo «el modelo elegido».

Clases: `ninguna (0)` gris · `pocas (1–2)` azul · `moderadas (3–10)` naranja · `muchas (11+)` verde.

---
## 1. Los datos — `grafico_datos` → `specs/datos.json`
**Título (generado):** «El 88 % de las secuencias no deja ninguna réplica, y sólo 142 de 21.292 dejan más de diez».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | 4 filas: clase, secuencias, porcentaje (de `n_aftershocks` pasado a intervalos con `a_intervalo`) | El desbalance es *el* hecho de los datos: explica la métrica y el piso. |
| Mapeo | `y` = clase (N, orden fijo); `x` = secuencias (Q); `color` = clase | Barras horizontales para que los nombres de clase se lean enteros. |
| Marca | barra + texto a la derecha con conteo y % | Las barras chicas (142) siguen siendo legibles porque el número está afuera. |
| Transformación | `transform_calculate(etiqueta)` arma «18.753 (88,1 %)» | |
| Escala | `x` lineal con cero (barras: se comparan longitudes); `color` = `ESCALA_CLASE` | Con cero porque una barra sin cero miente. Sin escala log: que la clase «muchas» sea diminuta *es* el mensaje. |

## 2. Lo que encontramos — `grafico_hallazgo` → `specs/hallazgo.json` (H1, sostenida)
**Título (generado):** «Las réplicas crecen con la magnitud: de 0,2 de media en los sismos que apenas superan el umbral a 128 en los que lo superan por 2,5 a 3 puntos».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Un punto por tramo de 0,5 de `mag_sobre_mc` con al menos 10 secuencias (7 tramos) | `mag_sobre_mc` y no la magnitud cruda: con la cruda, el tramo M4–4,5 mezcla regiones que detectan desde 4,2 con otras desde 4,7 y sale distorsionado. |
| Mapeo | `x` = centro del tramo (Q); `y` = réplicas medias (Q); `size` = secuencias en el tramo | El tamaño avisa que los tramos de la derecha tienen pocas secuencias. |
| Marca | círculo (los tramos) + línea punteada (el ajuste) | |
| Transformaciones | `log(media)` → `transform_regression` lineal → `exp()` | Una recta en escala log es crecimiento por un factor constante por punto. El ajuste va **en el gráfico** para que se pueda leer cómo se hizo. |
| Escala | `y` logarítmica, dominio 0,1–1000; `x` sin cero | Las réplicas medias van de 0,2 a más de 100: en lineal los primeros tramos serían una línea pegada al piso. La escala log es la transformación no obvia; va explicada en «Cómo lo sabemos». |

## 3. El modelo — `grafico_modelo` → `specs/modelo.json`
**Título (generado):** «El modelo más que duplica al piso: f1 de 0,50 contra 0,24 en sismos que no vio».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | 12 modelos × (f1 macro medio, desvío) en validación temporal, tabla del notebook de la Entrega 3 | La comparación honesta es con media y desvío, no un número solo. |
| Mapeo | `y` = modelo, ordenado por f1; `x` / `x2` = media − desvío / media + desvío; color = elegido o no | |
| Marca | segmento (rango) + punto (media) + texto (media) + regla vertical (piso) | Si el segmento de un modelo toca la línea del piso, no le gana al piso. |
| Escala | `x` de 0 a 0,6 con cero | El cero evita que una diferencia chica parezca enorme. |

**Ojo al leerlo:** los tres Poisson caen dentro de un desvío entre sí. Se eligió el de `alpha=0,001` y `empuje=0,4` por la regla de la Entrega 3, no porque sea estadísticamente mejor.

## 4. Explorá — `grafico_explora` → `specs/explora.json` (la copa)
Dos gráficos apilados que comparten los controles. Los datos viajan aparte (`data/explora_filas.json`, 21.292 filas).

**Controles, y qué componente toca cada uno** (son parámetros con nombre de Altair):

| Parámetro | Control | Qué toca |
|---|---|---|
| `region` | menú | `transform_filter` de las dos vistas (mapa y barras) |
| `mag_min` | deslizador 4,0–8,0 | `transform_filter` de las dos vistas |
| `ver` | menú: solo test / todas | `transform_filter` de las dos vistas (`test == 1`) |
| `color_por` | menú: clase real / clase que dijo el modelo | `transform_calculate` → el canal **color** (y el orden de dibujo) del mapa |
| `zona` | rectángulo dibujado sobre el mapa | opacidad de los puntos y `transform_filter` de las barras |

| Componente | Mapa (panorama) | Barras (resultado del modelo) |
|---|---|---|
| Datos | las 21.292 secuencias (por defecto, sólo las 4.259 de test) | las mismas, filtradas igual |
| Mapeo | `x` longitud, `y` latitud, `size` magnitud, `color` clase | `x` clase real, `y` proporción, `color` clase que dijo el modelo |
| Marca | círculos con borde blanco fino + rectángulos de las 5 regiones | barras apiladas al 100 % |
| Escala | `size` raíz cuadrada (el área sigue a la magnitud); `x`, `y` sin cero | `y` normalizada 0–100 % |
| Detalle a pedido | tooltip: lugar, fecha, magnitud, profundidad, réplicas reales, clase real, **lo que dijo el modelo**, réplicas esperadas, las cuatro probabilidades y la **partición** | tooltip con conteos |

Por defecto se muestra sólo **test**, porque son las secuencias que el modelo no vio al entrenar. Si el usuario elige «todas», cada punto dice en su tooltip si es de entrenamiento.
