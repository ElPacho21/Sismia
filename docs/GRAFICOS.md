# Gráficos de Sisimia, componente por componente

Todos hechos con Altair en `graficos.py` y exportados por `build_app.py` como especificaciones
Vega-Lite en `app/public/specs/`. **Regla de color** (una sola paleta, en `palette.py`):

- El color de las cuatro clases **siempre** es la *clase de réplicas* (escala `ESCALA_CLASE`). Donde un gráfico muestra
  secuencias o cantidades de réplicas, se pintan por su clase: los puntos del paso 1, los de los casos atípicos y los
  promedios del hallazgo.
- Lo que no es una clase usa dos acentos con significado fijo: **azul verdoso** `#19a4b7` = lo que se adoptó o usa el
  modelo; **rosa** `#d15d7d` = lo que se probó y se descartó. Lo demás va en grises (también lo que no puede entrar al modelo), y los grupos de casos, con la forma.
- Los dos acentos se validaron con `validate_palette.js` (guía de visualización) sobre el fondo de los gráficos (`#111a2b`):
  entre sí se distinguen también con daltonismo (ΔE 9,0 deutan; 25,5 con visión normal). Con los colores de las clases no
  pasan (el azul verdoso se parece al verde de «muchas»), por eso **nunca comparten un gráfico** con ellos.

Clases: `ninguna (0)` gris · `pocas (1–2)` azul · `moderadas (3–10)` naranja · `muchas (11+)` verde.

Cada sección del tallo tiene un gráfico principal (el que prueba el título) y un segundo gráfico que sigue la historia.
Los del «Cómo lo sabemos» del modelo reemplazan a las tablas (salvo la de comparación de modelos, que la consigna pide como tabla).

---
## 1. Los datos

### `grafico_datos` → `specs/datos.json` (prueba el título)
**Título (generado):** «El 88 % de las secuencias no deja ninguna réplica, y sólo 142 de 21.292 dejan más de diez».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | 4 filas: clase, secuencias, porcentaje (de `n_aftershocks` pasado a intervalos con `a_intervalo`) | El desbalance es *el* hecho de los datos: explica la métrica y el piso. |
| Mapeo | `y` = clase (N, orden fijo); `x` = secuencias (Q); `color` = clase | Barras horizontales para que los nombres de clase se lean enteros. |
| Marca | barra + texto a la derecha con conteo y % | Las barras chicas (142) siguen siendo legibles porque el número está afuera. |
| Transformación | `transform_calculate(etiqueta)` arma «18.753 (88,1 %)» | |
| Escala | `x` lineal con cero; `color` = `ESCALA_CLASE` | Con cero porque una barra sin cero miente. Sin escala log: que la clase «muchas» sea diminuta *es* el mensaje. |

### `grafico_columnas` → `specs/columnas.json` («De las 27 columnas del dataset, el modelo usa 3»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Una fila por columna del dataset (27): nombre, grupo y motivo. El inventario está en `build_app.py` (`COLUMNAS`) y el build falla si el dataset trae una columna que no está ahí | Cuenta de dónde salen las 3 columnas del modelo sin mostrar la tabla técnica de fuga (que queda en «Cómo lo sabemos»). |
| Mapeo | `y` = grupo (N, en orden de lectura: de lo que no puede entrar a lo que usa el modelo); `x` = posición dentro del grupo (Q, sin eje); `color` = estado (no pueden entrar / se probaron y no mejoraron / las usa el modelo) | Una fila por motivo: la cantidad de cuadrados es la cantidad de columnas, se cuenta sin leer números. Las 12 que se probaron van juntas; el tooltip de cada una dice su resultado. |
| Marca | un cuadrado por columna + texto a la derecha (la cantidad y, en las dos últimas filas, cuáles son) | |
| Escala | color: gris = no pueden entrar, rosa = se probaron y no mejoraron, azul verdoso = las 3 que usa el modelo | No son clases de réplicas, así que usan los dos acentos y no los colores de las clases. |
| Detalle | tooltip: columna, grupo y por qué está ahí | |

## 2. Lo que encontramos

### `grafico_hallazgo` → `specs/hallazgo.json` (H1, sostenida; prueba el título)
**Título (generado):** «Las réplicas crecen con la magnitud: de 0,2 de media en los sismos que apenas superan el umbral a 128 en los que lo superan por 2,5 a 3,0 puntos».

Dos paneles lado a lado (`hconcat`) con los mismos datos y el mismo eje horizontal.

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Un punto por tramo de 0,5 de `mag_sobre_mc` con al menos 10 secuencias (7 tramos); y una curva de 80 puntos con el ajuste | `mag_sobre_mc` y no la magnitud cruda: con la cruda, el tramo M4–4,5 mezcla regiones que detectan desde 4,2 con otras desde 4,7 y sale distorsionado. |
| Mapeo | `x` = centro del tramo (Q); `y` = réplicas medias (Q); `size` = secuencias en el tramo | El tamaño avisa que los tramos de la derecha tienen pocas secuencias. |
| Marca | círculo (los tramos), pintado por la clase en la que cae el promedio redondeado + línea punteada (el ajuste), en los dos paneles | El color dice, en la escala de todo el sitio, qué clase deja en promedio un sismo de cada tramo. |
| Transformación | el ajuste se calcula en `build_app.py`/`graficos.py`: recta sobre `log(media)` (`np.polyfit`) y vuelta con `exp()` | Es la misma curva en los dos paneles: recta en el logarítmico, curva en el lineal. |
| Escala | panel izquierdo: `y` **lineal** con cero (0–140); panel derecho: `y` **logarítmica** (0,1–1000) | El lineal muestra la forma del crecimiento (casi plano y después se dispara); el logarítmico separa los primeros tramos y muestra que cada tramo multiplica al anterior por un factor parecido. |

### `grafico_atipicos` → `specs/atipicos.json` («Pero la magnitud sola no alcanza: hay casos que se salen de la regla»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Las 21.292 secuencias, por URL (`data/explora_filas.json`, con `mag_max`: la magnitud mayor de la secuencia, sacada de los archivos de eventos); y 5 anotaciones elegidas por regla en `build_app.py` (`atipicos`) | Los atípicos se ven contra el resto, no solos. |
| Mapeo | `x` = magnitud del principal (Q, cruda); `y` = réplicas (Q); `color` = clase de réplicas; `shape`, `size` y `opacity` por grupo | Los grupos van por **forma**, no por color: el color es siempre la clase de réplicas. |
| Transformaciones | `transform_calculate(grupo)`: «Después vino un sismo mayor» si `mag_max > mag`; «M7 o más con 2 réplicas o menos»; si no, «Resto». `capa` dibuja el resto abajo | |
| Marca | punto (círculo / triángulo / cuadrado) + regla y texto para las anotaciones | |
| Escala | `y` **symlog** (logarítmica que incluye el 0), 0–5.000 | La mayoría tiene 0 réplicas y unas pocas, miles: en lineal todo quedaría pegado al piso, y en log el 0 no existe. |
| Detalle | tooltip: lugar, fecha, magnitud del principal, magnitud mayor de la secuencia, profundidad, réplicas | |

## 3. El modelo

### Los pasos de la historia (antes del gráfico principal)
La sección cuenta el modelado en el orden del notebook de la Entrega 3: seis pasos, cada uno con su texto y su gráfico, y al final el
camino completo. Los números salen de `pasos_entrega3` en `build_app.py` y se verifican contra el notebook (`tests/reference_metrics.json`).

| Paso | Gráfico | Datos | Mapeo y marca | Escala |
|---|---|---|---|---|
| 1 · Un intervalo, no un número | `grafico_intervalos` → `intervalos.json` | las 21.292 secuencias por URL; media, varianza / media, mínimo y máximo por tramo (celda 9) | un punto por secuencia, `x` = tramo de magnitud y `xOffset` = desparramo al azar (`random()`) para que no se tapen; una raya con la media; texto con sismos y varianza / media | `y` symlog (incluye el 0) |
| 2 · De la logística a Poisson | `grafico_ejemplo_poisson` → `ejemplo_poisson.json` | probabilidades y réplicas esperadas de la primera Poisson para M4,5, M6,0 y M7,5 a 30 km (celda 39) | barras apiladas, `color` = clase; texto con las réplicas esperadas y la respuesta | `x` de 0 a 100 % |
| 3 · El error tenía un patrón | `grafico_sesgo_region` → `sesgo_region.json` | réplicas reales / esperadas por región, con la magnitud cruda y sobre el umbral (celdas 43 y 50) | dos puntos por región (hueco rosa = cruda, la que se dejó; lleno azul verdoso = la que se adoptó) unidos por una línea; regla punteada en 1 | `x` lineal 0–1,5; regiones ordenadas por Mc |
| 4 · Más columnas, de a una | `grafico_columnas_probadas` → `columnas_probadas.json` | f1 medio y desvío agregando cada columna: región y sismos de 30 días (celda 54 de la Entrega 3) y las otras diez, probadas después con el mismo método (notebook del dataset final) | un punto por columna con su desvío; una banda azul verdosa de un desvío alrededor del modelo sin agregar nada; cuadrado = se probó al armar el modelo, círculo hueco = después | `x` 0,38–0,52; una columna sirve si su punto sale de la banda por la derecha |
| 5 · Familias, alpha y empuje | `grafico_empuje` → `empuje.json` | recall de cada clase y f1 macro según el empuje (celda 65) | ver más abajo | |
| 6 · Otros cortes | `grafico_cortes` → `cortes.json` | f1 del piso, la logística balanceada y Poisson con cinco esquemas de cortes (celda 70) | tres puntos por esquema (forma y color por modelo: gris el piso, rosa la logística, azul verdoso Poisson) sobre una barra que va del menor al mayor | `x` 0,15–0,60 |

### `grafico_evolucion` → `specs/evolucion.json` (prueba el título)
**Título (generado):** «El modelo más que duplica al piso: f1 de 0,50 contra 0,24 en sismos que no vio».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Cada paso de la Entrega 3 en el orden del notebook (`pasos_del_modelo` en `build_app.py`): piso, logística, Poisson, magnitud sobre el umbral, las columnas y familias que se probaron y se dejaron, alpha, empuje y el test. f1 macro medio y desvío en validación (el test, sin desvío) | Cuenta la historia de cómo se llegó al modelo en vez de una tabla. Todos los números son los del notebook y el build los verifica. |
| Mapeo | `y` = paso (N, orden del notebook); `x` = f1 macro; `x`/`x2` = media ± desvío; `color` y `shape` = estado (piso / se adoptó / se probó y se dejó / test) | |
| Marca | línea (el camino de lo adoptado, en orden) + segmento (desvío) + punto lleno azul verdoso (adoptado), hueco rosa (dejado), rombo (test) + texto con el valor + regla punteada (piso) | La línea une sólo lo que se adoptó: se ve dónde subió, dónde se quedó igual y dónde se cedió f1 (el empuje). |
| Escala | `x` de 0,20 a 0,56 | Empieza en 0,20 para que se distingan pasos que difieren en centésimas; el piso (0,235) queda marcado como referencia. |
| Detalle | tooltip: modelo, f1, desvío y «qué pasó» (por qué se adoptó o se dejó) | |

### `grafico_variables` → `specs/variables.json` («Las dos variables: la magnitud cambia la respuesta mucho más que la profundidad»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | (1) una grilla de magnitud sobre el umbral (0 a 4,5, de a 0,1) × profundidad (0 a 660 km, de a 10), con lo que contesta el modelo elegido en cada celda; (2) los sismos de entrenamiento contados en las mismas celdas; (3) los cuartiles 25 y 75 de la profundidad | Muestra las dos entradas del modelo a la vez y cuánto mueve cada una la respuesta, sobre la zona donde realmente hay sismos. |
| Mapeo | fondo: `x`/`x2`, `y`/`y2` = celda, `color` = clase que contesta el modelo; círculos: `x`, `y` = celda, `size` = cantidad de sismos | El color es la clase de réplicas (la misma escala de todo el sitio). |
| Marca | rectángulos (fondo) + círculos (sismos) + dos reglas punteadas con un texto | |
| Escala | `y` invertida (la profundidad crece hacia abajo, como en la Tierra); `size` raíz cuadrada | |
| Cómo se lee | Recorrer la magnitud cruza las cuatro clases; la profundidad corre los cortes en diagonal (100 km ≈ 0,49 puntos de magnitud), pero entre las dos líneas, donde está la mitad de los sismos, los corre apenas 0,27 puntos | |

### «Cómo lo sabemos» del modelo
| Gráfico | Datos | Mapeo y marca | Escala |
|---|---|---|---|
| `grafico_folds` → `folds.json` | los 5 folds de `TimeSeriesSplit` (fechas y filas) y el f1 del elegido en cada uno | barras horizontales `x`/`x2` = desde/hasta, `y` = fold, color = entrena / valida; texto con el f1 | `x` temporal |
| `grafico_alpha` → `alpha.json` | f1 medio y desvío para alpha 0,001 a 10 (empuje 0) | punto + segmento vertical; el elegido en azul verdoso | `x` logarítmica |
| `grafico_empuje` → `empuje.json` (en el paso 5) | recall de cada clase y f1 macro para empuje 0 a 0,5 | líneas con puntos; color = clase (los recall) y blanco (f1 macro); regla punteada en el elegido | `y` de 0 a 1 |
| `grafico_reporte` → `reporte.json` | precisión, recall y f1 de cada clase en el test | barras facetadas por medida; color = clase | `x` de 0 a 1 |
| `grafico_confusion` → `confusion.json` | matriz de confusión del test | rectángulos con `opacity` = proporción de la fila y texto = cantidad | un solo color claro; la intensidad es la proporción (no se usan los colores de clase porque fila y columna ya son clases) |
| `grafico_tramos_test` → `tramos.json` | acierto del intervalo por tramo de magnitud en el test | barras + texto con % y cantidad | `x` de 0 a 100 % |
| `grafico_permutacion` → `permutacion.json` | cuánto baja el f1 del test al desordenar cada columna (20 repeticiones) | barra (media) + segmento (± desvío) + texto | `x` de 0 a 0,3 |

La comparación de modelos queda como **tabla** (media y desvío), porque la consigna la pide así.

## 4. Explorá (la copa)

El panorama es el **globo** (three, en `app/src/globo/`; no es Altair). Debajo, un gráfico de Altair con el resultado del modelo.
Los dos responden a los mismos filtros, que están arriba del globo.

**Controles, y qué componente toca cada uno:**

| Control | Globo | Barras (`grafico_resultado` → `specs/resultado.json`) |
|---|---|---|
| Región (menú, o click en una región del globo) | qué puntos se ven, y la cámara vuela a la región | parámetro `region` → `transform_filter` |
| Magnitud mínima (deslizador 4,0–8,0) | qué puntos se ven | parámetro `mag_min` → `transform_filter` |
| Secuencias: sólo test / todas | qué puntos se ven | parámetro `ver` → `transform_filter` (`test == 1`) |
| Pintar según: clase real / clase que dijo el modelo | el color de los puntos | — |

Los parámetros de las barras no tienen control propio: la página los fija con `vista.signal()` cuando cambia un filtro (`Grafico.jsx`).

| Componente | Barras: lo que dijo el modelo para cada clase real |
|---|---|
| Datos | las 21.292 secuencias por URL (`data/explora_filas.json`), filtradas por los tres parámetros |
| Transformaciones | `transform_aggregate` por (real, dijo el modelo) → `transform_joinaggregate` del total de cada clase real → `transform_calculate(proporcion)` |
| Mapeo | `x` = clase real; `y` = proporción (apilada al 100 %); `color` = clase que dijo el modelo |
| Marca | barras apiladas |
| Escala | `y` normalizada 0–100 %; color = `ESCALA_CLASE` |
| Detalle a pedido | tooltip con la cantidad y el % de la barra |

El detalle a pedido de cada secuencia está en el globo: al pasar el mouse por un punto muestra lugar, fecha, magnitud, profundidad,
réplicas reales, clase real, **lo que dijo el modelo**, réplicas esperadas y las cuatro probabilidades.
