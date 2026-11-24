# Gráficos de Sisimia, componente por componente

Todos hechos con Altair en `graficos.py` y exportados por `build_app.py` como especificaciones
Vega-Lite en `app/public/specs/`. **Regla de color** (una sola paleta, en `palette.py`):

- El color de las cuatro clases **siempre** es la *clase de réplicas* (escala `ESCALA_CLASE`). Donde un gráfico muestra
  secuencias o cantidades de réplicas, se pintan por su clase: los puntos del paso 1, los de los casos atípicos y los
  promedios del hallazgo.
- Lo que no es una clase usa dos acentos con significado fijo: **turquesa** `#7cc0bd` = lo que se adoptó o usa el
  modelo; **rosa** `#c66f76` = lo que se probó y se descartó. Lo demás va en el neutro `#7d6853` (también lo que no puede entrar al modelo), y los grupos de casos, con la forma.
- Colores del design system *Sisimia Estratos*, tema basalto, validados simulando protanopía, deuteranopía y tritanopía
  sobre el fondo de los gráficos (`#211912`): entre las cuatro clases ΔE ≥ 13 y entre los dos acentos ΔE ≥ 12 con
  cualquier daltonismo; las clases se separan por tono y por luminosidad. Los acentos igual **nunca comparten un gráfico** con
  las clases, para que cada color signifique una sola cosa.

Clases (cuatro tonos, de oscura a clara en basalto): `ninguna (0)` gris piedra · `pocas (1–2)` celeste · `moderadas (3–10)` naranja · `muchas (11+)` lila.
La línea del empuje elegido va en el neutro, no en turquesa: es el único gráfico donde el acento comparte espacio con las clases.

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
| Mapeo | Un recuadro por columna, siempre en el mismo `x` (en píxeles), agrupadas por motivo de salida con un hueco entre grupos; `y` = la fila del paso (dataset → existen en el momento del sismo → usa el modelo) | Las tres filas tienen el mismo ancho: la cantidad se cuenta en recuadros llenos (27, 15, 3), no en un ancho que se achica como una escalera. Cada columna se sigue de una fila a otra. |
| Marca | `rect` lleno = la columna sigue en ese paso; con sólo el borde = ya salió. Arriba de cada fila, su rótulo con la cantidad; debajo de la última, una llave por grupo con «n motivo» (en dos alturas alternadas para no pisarse) | Se lee sin pasar el mouse. |
| Escala | gris = las columnas que siguen; turquesa = las que usa el modelo (en las tres filas, para seguirlas); borde gris = salieron porque no pueden entrar; borde rosa = se probaron y se descartaron | Los mismos dos acentos que el resto de la aplicación. |
| Detalle | tooltip de cada recuadro: la columna, el paso, si sigue o por qué salió, y qué es; tooltip de cada rótulo de grupo: sus columnas y por qué salen | |

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

### `grafico_semaforo` → `specs/semaforo.json` («La magnitud pasa el semáforo de la Entrega 2; la profundidad, sólo cuando se miran los sismos grandes»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | `hipotesis.json → semaforo` (`semaforo_columnas` en `build_app.py`): Spearman (numéricas) o η² (región y las de sí o no) de las 15 columnas que existen en el momento del sismo contra `n_aftershocks`, y los dos movimientos de cada una: la magnitud (Spearman) en M6 o más y en M6 o más someros; la profundidad, en tres franjas (η²) y en M6 o más (separación someros / profundos). El build los verifica contra el notebook del dataset final (celdas 39, 41, 46, 49 y 50) | Es la tabla de columnas candidatas de la Entrega 2 contada como gráfico: muestra por qué el modelo usa esas columnas y no otras. |
| Mapeo | `y` = columna (con su medida entre paréntesis); `x` = posición fija de la celda (sin eje): «antes: todas las secuencias», «movimiento 1» y «movimiento 2», con flechas entre una y otra; la segunda línea de cada celda dice qué medida es (antes) o qué movimiento se hizo; `color` = zona del semáforo | Se lee como una tabla: el antes y el después del movimiento quedan uno al lado del otro. |
| Marca | `vconcat`: encabezado con los nombres de las tres columnas; un bloque por columna que usa el modelo, titulado con la hipótesis de la Entrega 2 que la ponía a prueba (H1 para la magnitud, H3 para la profundidad) y, como subtítulo, qué pasó con ella. Las otras 12 no van en el gráfico: se probaron directamente en el modelo (paso 4) y su tabla está en «Cómo lo sabemos». `rect` por celda con el valor y la zona escritos adentro | Se lee sin pasar el mouse. Los η² que dan prácticamente cero se escriben «< 0,001». |
| Escala | `COLOR_SEMAFORO` (rojo, amarillo, verde) | Rojo y verde no se distinguen con daltonismo: la zona va escrita en cada celda. |
| Detalle | tooltip: columna, sobre qué secuencias, medida, valor y qué significa la zona | |

### `grafico_movimientos` → `specs/movimientos.json` («Cuanto más grande el sismo, más réplicas; la profundidad sólo marca diferencia en los sismos grandes»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | `hipotesis.json → semaforo.reparto`: de cada 100 sismos de cada grupo, cuántos caen en cada clase de réplicas. El gráfico usa sólo «muchas (11+)»: por tramo de magnitud (H1) y someros contra profundos, con todos los sismos y sólo con los de M6 o más (H3) | Es el apoyo visual del semáforo para alguien que no conoce las medidas: un solo número por grupo. |
| Mapeo | `y` = grupo (por la magnitud o la profundidad del sismo principal); `x` = de cada 100 secuencias, en cuántas hubo más de 10 réplicas (sin eje: el número va escrito) | Se cuenta en secuencias, la unidad de todo el proyecto, para que no se confunda con las réplicas. |
| Marca | barra + número a la derecha; un bloque por hipótesis (H1, H3), y la H3 partida en «todos los sismos» y «sólo M6 o más» | Se lee de un vistazo: las barras crecen con la magnitud, y someros y profundos sólo se separan en los sismos grandes. |
| Escala | un solo color: el verde de «muchas (11+)» | El mismo color que esa clase en todo el tallo. |
| Detalle | tooltip: grupo, cuántos sismos tiene y el valor | |

### `grafico_cinturon` → `specs/cinturon.json` («Las cinco regiones están sobre el Cinturón de Fuego del Pacífico»)
| Componente | Qué es | Por qué |
|---|---|---|
| Datos | continentes: Natural Earth 110m (`data/land-110m.json`, de `world-atlas`, con su licencia al lado); rectángulos: los de la consulta a USGS de cada región (`pipeline/include/sismos/regions.yaml`) con sus secuencias; el cinturón: un trazado aproximado a mano (`CINTURON` en `graficos.py`) | Muestra por qué esas cinco regiones sin necesidad de explicar el método. |
| Mapeo | `geoshape` con proyección Natural Earth centrada en el Pacífico (`rotate` −160°) | Centrado en el Pacífico para que el cinturón no quede partido en los bordes. |
| Marca | esfera y continentes de fondo; el cinturón como una franja ancha en arcilla y semitransparente; cada región, un rectángulo turquesa (los lados se densifican para seguir la curvatura) con su nombre y sus secuencias | El cinturón se rotula «trazado aproximado»: es una guía, no el límite de las placas. |
| Detalle | tooltip de cada rectángulo: región y secuencias | |
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
| 2 · Pasamos de la logística a Poisson | `grafico_logistica_poisson` → `logistica_poisson.json` | f1 macro en validación de la regresión logística, la logística balanceada y la primera Poisson, con las mismas dos entradas (tabla de comparación del notebook) | barra por modelo (turquesa = adoptado, rosa = descartado) + valor; línea punteada = el piso | `x` de 0 a 0,55: muestra la decisión, no sólo cómo funciona Poisson |
| 3 · El error tenía un patrón | `grafico_sesgo_region` → `sesgo_region.json` | réplicas reales / esperadas por región, con la magnitud cruda y sobre el umbral (celdas 43 y 50) | dos puntos por región (hueco rosa = cruda, la que se dejó; lleno turquesa = la que se adoptó) unidos por una línea; regla punteada en 1 | `x` lineal 0–1,5; regiones ordenadas por Mc |
| 4 · Más columnas, de a una | `grafico_columnas_probadas` → `columnas_probadas.json` | f1 medio y desvío agregando cada columna: región y sismos de 30 días (celda 54 de la Entrega 3) y las otras diez, probadas después con el mismo método (notebook del dataset final) | un punto por columna con su desvío; una banda turquesa de un desvío alrededor del modelo sin agregar nada; cuadrado = se probó al armar el modelo, círculo hueco = después | `x` 0,38–0,52; una columna sirve si su punto sale de la banda por la derecha |
| 5 · Familias, alpha y empuje | `grafico_empuje` → `empuje.json` | recall de cada clase y f1 macro según el empuje (celda 65) | ver más abajo | |
| 6 · Mantuvimos los cortes | `grafico_cortes` → `cortes.json` | f1 macro de Poisson y de la logística balanceada con cinco esquemas de cortes (celda 70) | una fila por esquema (el nuestro, resaltado): punto rosa = logística, punto turquesa = Poisson, unidos por una línea; el piso, en el tooltip | `x` de 0,2 a 0,6. Los f1 no se comparan entre filas (con menos intervalos todo sube): lo que se lee es que en cada fila Poisson queda a la derecha |

### `grafico_evolucion` → `specs/evolucion.json` (prueba el título)
**Título (generado):** «El modelo más que duplica al piso: f1 de 0,50 contra 0,24 en sismos que no vio».

| Componente | Qué es | Por qué |
|---|---|---|
| Datos | Cada paso de la Entrega 3 en el orden del notebook (`pasos_del_modelo` en `build_app.py`): piso, logística, Poisson, magnitud sobre el umbral, las columnas y familias que se probaron y se dejaron, alpha, empuje y el test. f1 macro medio y desvío en validación (el test, sin desvío) | Cuenta la historia de cómo se llegó al modelo en vez de una tabla. Todos los números son los del notebook y el build los verifica. |
| Mapeo | `y` = paso (N, orden del notebook); `x` = f1 macro; `x`/`x2` = media ± desvío; `color` y `shape` = estado (piso / se adoptó / se probó y se dejó / test) | |
| Marca | línea (el camino de lo adoptado, en orden) + segmento (desvío) + punto lleno turquesa (adoptado), hueco rosa (dejado), rombo (test) + texto con el valor + regla punteada (piso) | La línea une sólo lo que se adoptó: se ve dónde subió, dónde se quedó igual y dónde se cedió f1 (el empuje). |
| Escala | `x` de 0,20 a 0,56 | Empieza en 0,20 para que se distingan pasos que difieren en centésimas; el piso (0,235) queda marcado como referencia. |
| Detalle | tooltip: modelo, f1, desvío y «qué pasó» (por qué se adoptó o se dejó) | |

### «Cómo lo sabemos» del modelo
| Gráfico | Datos | Mapeo y marca | Escala |
|---|---|---|---|
| `grafico_folds` → `folds.json` | los 5 folds de `TimeSeriesSplit` (fechas y filas) y el f1 del elegido en cada uno | barras horizontales `x`/`x2` = desde/hasta, `y` = fold, color = entrena / valida; texto con el f1 | `x` temporal |
| `grafico_alpha` → `alpha.json` | f1 medio y desvío para alpha 0,001 a 10 (empuje 0) | punto + segmento vertical; el elegido en turquesa | `x` logarítmica |
| `grafico_empuje` → `empuje.json` (en el paso 5) | recall de cada clase y f1 macro para empuje 0 a 0,5 | líneas con puntos; color = clase (los recall) y blanco (f1 macro); regla punteada en el elegido | `y` de 0 a 1 |
| `grafico_reporte` → `reporte.json` | precisión, recall y f1 de cada clase en el test | barras facetadas por medida; color = clase | `x` de 0 a 1 |
| `grafico_confusion` → `confusion.json` | matriz de confusión del test | rectángulos con `opacity` = proporción de la fila y texto = cantidad | un solo color claro; la intensidad es la proporción (no se usan los colores de clase porque fila y columna ya son clases) |
| `grafico_tramos_test` → `tramos.json` | acierto del intervalo por tramo de magnitud en el test | barras + texto con % y cantidad | `x` de 0 a 100 % |
| `grafico_permutacion` → `permutacion.json` (pasó al tallo: «El modelo se apoya en la magnitud») | f1 macro del test con todas las columnas y desordenando cada una (importancia por permutación, media de 20 repeticiones; el desvío, en el tooltip) | barra por versión (turquesa = el modelo, gris = con una columna desordenada) + valor y cuánto baja; línea rosa punteada = el piso | `x` de 0 a 0,6: desordenando la magnitud, la barra queda pegada al piso |

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
