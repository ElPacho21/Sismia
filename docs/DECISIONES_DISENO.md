# Decisiones de diseño: qué cambió en cada gráfico

Sólo cambios **reales**, con el motivo. Si un gráfico no cambió, no figura.

## Lo que encontramos (H1) — `grafico_hallazgo`
- **v1 → v2, la recta de ajuste.** La v1 usaba `transform_regression(method="exp")` de Vega-Lite. Al renderizar, la
  recta quedaba muy por encima de los puntos y con otra pendiente que el ajuste hecho en Python, así que el gráfico
  contradecía su propio título. La v2 calcula `log(media)`, ajusta una recta lineal y vuelve con `exp()`: ahora la
  recta pasa por los puntos y se ve en el gráfico cómo se calculó.
- **v1 → v2, el título.** La v1 decía «cada punto sobre el umbral las multiplica por 8,8». Ese ×8,8 salía del ajuste
  sobre los promedios por tramo, y la portada dice ×7,6 (el coeficiente del modelo). Dos números distintos para algo
  que parece lo mismo confundía. La v2 usa dos promedios que se leen directo en el gráfico (0,2 y 128: el primer tramo y el de +2,5 a +3,0). El ×7,6 queda
  como el número del modelo; la diferencia con 8,8 se explica en «Cómo lo sabemos».
- **Eje x.** Desde el principio se usó `mag_sobre_mc` en lugar de la magnitud cruda: con la cruda el primer tramo
  (M4–4,5) tiene *más* réplicas que el siguiente, porque México detecta desde 4,2 y las demás regiones desde 4,6 o 4,7.
  Es el mismo problema que motivó la columna `mag_sobre_mc` en la Entrega 3.

## Los datos — `grafico_datos`
- **v1 → v2, separador de miles.** La v1 reemplazaba comas por puntos con `labelExpr` en el eje, lo que se pisaba con
  el formato de los textos. La v2 saca ese parche y deja que `vega-embed` aplique el idioma español a todo.

## Modelo — comparación de modelos (`comparacion_validacion`)
- **Dos filas usan los números del notebook y no los medidos en el build.** `random forest (balanced)` y
  `gradient boosting (balanced)` no reproducen exacto en este entorno (por ejemplo 0,302 contra 0,325 el random
  forest). Los demás 10 modelos, incluidos el piso y Poisson, coinciden dentro de 0,0006. La causa probable es la
  versión de scikit-learn (el notebook se corrió en otra), pero **no está verificada**. Ver `metricas.json`
  (`comparacion_medida_en_build`) y el aviso que imprime `build_app.py`.

## Explorá — título de H1 y peso de los datos
- **v1 → v2, el número del título de H1.** La v1 citaba la media de *todas* las secuencias que superan el umbral por
  2,5 puntos o más (169). Ese promedio lo tiran unos pocos megasismos y no se podía leer en el gráfico, que sólo
  muestra tramos con al menos 10 secuencias. La v2 cita el punto del tramo +2,5 a +3,0 (128), que se ve directo.
- **Datos del mapa.** La v1 mandaba 8 MB de filas (con una columna `acierta`, un `id` y coordenadas con 3 decimales
  que no se usan). La v2 saca esas columnas y redondea, y la partición se calcula dentro del gráfico.

## Explorá — ancho y leyendas
- **v1 → v2, ancho.** La v1 tenía el mapa y las barras de 760 px de ancho; con la leyenda no entraban en la columna de la
  página y aparecía una barra de desplazamiento horizontal dentro del gráfico. La v2 los pasa a 680 px.
- **v1 → v2, leyenda de color.** Las barras compartían la escala de color con el mapa, y Vega avisaba por consola de una
  leyenda en conflicto («Conflicting legend property disable»). La v2 declara la escala de color de las barras como
  independiente (con el mismo dominio y los mismos colores); la leyenda sigue estando una sola vez, en el mapa.

## Globo 3D — `app/src/globo/escena.js`
- **v1 → v2, el color de la esfera.** La v1 salía gris azulada en vez de casi negra: los materiales propios de three
  (esfera, líneas) convertían los colores de lineal a sRGB, y mis shaders no, así que no coincidían. La v2 fija
  `outputColorSpace = LinearSRGBColorSpace`: ningún color se convierte y todos salen como en la paleta.
- **v1 → v2, el diseño de la página.** La v1 ponía el globo en una columna angosta con el panel a la derecha, y las
  regiones quedaban recortadas en los bordes. La v2 pone el globo a todo el ancho y el panel debajo, en tres columnas
  (filtros, animación, prueba del modelo).
- **v1 → v2, la vista inicial.** La v1 arrancaba mirando el Pacífico, casi vacío (las regiones quedaban en los
  bordes). La v2 arranca sobre Asia-Pacífico, donde se ven tres de las cinco regiones.
- **v1 → v2, el tamaño de los eventos en la animación.** En la v1 los eventos de una secuencia usaban el mismo tamaño
  que los puntos del mapa; con la cámara cerca (se acerca a la secuencia), los 2.545 eventos de la secuencia de Japón se
  fundían en una mancha verde. La v2 achica el núcleo (×0,3) y el anillo (×0,45) en el modo secuencia.
- **Animación: tiempo logarítmico.** Decisión del grupo: el reloj corre en `log10(1 + horas)` para que las primeras horas
  ocupen tanto como los últimos meses (el estallido y la cola larga se ven los dos). El reloj muestra el tiempo real.

## Globo 3D — zoom sobre una secuencia
- **v2 → v3, el encuadre.** Al elegir una secuencia la cámara se acercaba como mucho a 1,5 radios y, con los eventos
  superpuestos (la de Japón tiene 2.545 en pocos cientos de km), se veían apretados. La v3 se acerca hasta casi la
  superficie (distancia mínima 1,03) encuadrando el 80 % de los eventos, y hay dos botones: «Acercar al núcleo» y «Ver
  toda la secuencia» (incluye los más lejanos).
- **Por qué hizo falta tocar el tamaño.** Los puntos tienen un tamaño en unidades del mundo, así que acercar la cámara los
  agrandaba y seguían tapándose. Ahora el tamaño se multiplica por un factor que baja con la distancia a la superficie
  (`uK`): al acercarse, los puntos se achican en el mundo y el zoom los *separa*. La velocidad de giro baja igual, para
  que arrastrar no «salte» cuando se está cerca.

## Devolución de la Entrega 4 — contar la historia
Cambios pedidos por el docente después de la Entrega 4. El hilo: que cada sección cuente cómo se llegó a lo que afirma.

- **Portada: la pregunta, lo más grande.** La v2 tenía la respuesta («El modelo sirve para priorizar…») como título grande y la
  pregunta en chico, arriba. La v3 invierte: la pregunta es el `h1` y la respuesta va debajo, más chica.
- **Los datos: de 27 columnas a 3 (`grafico_columnas`, nuevo).** Antes, cuántas columnas tenía el dataset y por qué el modelo usa
  tres sólo se podía reconstruir leyendo la tabla de fuga del «Cómo lo sabemos». Ahora un gráfico en el flujo principal muestra
  las 27 columnas en filas según el motivo (identifican, son la respuesta, fuga, constantes, correlación casi nula en el análisis exploratorio, existen al predecir y no se probaron, probadas, usadas).
  El texto técnico de cada columna de fuga sigue en «Cómo lo sabemos».
- **Lo que encontramos: eje lineal además del logarítmico.** La v2 tenía sólo el eje logarítmico, que muestra el factor constante
  pero esconde la forma: no se ve que el crecimiento es explosivo. La v3 pone los dos paneles lado a lado con los mismos puntos y
  la misma curva. La curva ahora se calcula en Python: `transform_regression` de Vega-Lite devuelve sólo los dos extremos de la
  recta, y en el panel lineal la curva exponencial habría quedado como un segmento recto.
- **Lo que encontramos: los casos atípicos (`grafico_atipicos`, nuevo).** Magnitud contra réplicas de todas las secuencias, con los
  atípicos por forma: los principales a los que después les siguió un sismo mayor (triángulos) y los M7 o más casi sin réplicas
  (cuadrados). Por forma y no por color, porque el color es siempre la clase. Los rótulos salen por regla, no elegidos a mano.
- **El modelo: la historia en vez de la tabla (`grafico_evolucion` reemplaza a `grafico_modelo`).** La v2 mostraba los 12 modelos
  ordenados por f1, que es una tabla dibujada: no decía en qué orden se probaron ni por qué se adoptó cada cosa. La v3 sigue el orden
  del notebook y une con una línea lo que se adoptó; lo que se probó y se dejó queda en gris y hueco al lado del paso en que se probó.
- **El modelo: las dos variables (`grafico_variables`, nuevo).** Lo que contesta el modelo para cada combinación de magnitud sobre el
  umbral y profundidad, con los sismos de entrenamiento encima. Se eligió este gráfico y no dos curvas de réplicas esperadas porque la
  pregunta era por la *predicción* (la clase): se ve cuánto corre cada eje los cortes entre clases donde de verdad hay sismos.
- **«Cómo lo sabemos» del modelo, sin tablas salvo una.** Folds, alpha, empuje, reporte por clase, matriz de confusión, acierto por
  tramo e importancia por permutación pasan a gráficos. La comparación de modelos queda como tabla porque la consigna la pide así.
- **Explorá: sólo el globo.** El mapa de Altair y el globo mostraban prácticamente lo mismo. Se sacó el mapa; el globo es el panorama
  y sus filtros mueven también las barras de Altair con el resultado del modelo, que quedaron debajo. Como el detalle a pedido del
  mapa tenía las probabilidades y las réplicas esperadas, se agregaron al detalle del globo. Si el navegador no tiene WebGL, los
  filtros siguen visibles y las barras siguen respondiendo.
- **El modelo: la historia en pasos (segunda vuelta).** Con un solo gráfico la sección seguía siendo un resumen: el notebook de la
  Entrega 3 cuenta el camino con varios gráficos. Ahora, antes del camino completo, hay seis pasos en el orden del notebook, cada uno con
  lo que hicimos, por qué y su gráfico: por qué intervalos, de la logística a Poisson, el sesgo por región, las dos columnas probadas de a
  una, familias / alpha / empuje y los otros cortes. El gráfico del empuje pasó del «Cómo lo sabemos» al paso 5.
- **Casos atípicos: puntos más grandes.** En la v1 los puntos del «resto» (10 px², opacidad 0,45) casi no se veían sobre el fondo
  oscuro. La v2 los agranda (24 / 75 / 120 px² según el grupo) y sube la opacidad del resto a 0,6.
- **Color.** La v2 tenía casi todo en grises y blanco: el color estaba reservado a las clases y el resto iba neutro. La v3
  agrega color sin romper esa regla: donde el gráfico muestra secuencias o réplicas, se pintan por su clase (paso 1, casos
  atípicos, promedios del hallazgo), y lo que no es una clase usa dos acentos fijos (azul verdoso = adoptado / lo usa el
  modelo; rosa = descartado / no puede entrar). Se probó también un violeta y un amarillo como acentos, y se descartaron
  con el validador: el violeta se confunde con el azul de «pocas» y el amarillo con el naranja de «moderadas».
- **El modelo, paso 4: todas las columnas probadas (rama `columnas-probadas`).** Ocho columnas que existen en el momento del sismo no
  se habían probado porque el dataset con el que se empezó no las tenía, y la latitud y la longitud se habían descartado sólo por su
  correlación. Se probaron después con el método de la celda 54 (notebook del dataset final) y ninguna mejora el f1 por más que el
  desvío. El gráfico del paso 4 pasa de las tres líneas por fold (que no entraban con doce columnas) a un punto por columna contra la
  banda de un desvío del modelo sin agregar nada: se lee de un vistazo que ninguna sale de la banda. En el gráfico de las columnas, las
  12 probadas pasan a un solo grupo, en rosa (se probaron y se descartaron), y lo que no puede entrar pasa a gris.
- **Las columnas, con el semáforo de la Entrega 2.** El gráfico de cuadrados («De las 27 columnas, el modelo usa 3») sólo decía
  cuántas quedaban, y para saber por qué había que pasar el mouse por cada cuadrado. Lo reemplaza el semáforo de las 15 columnas que
  existen en el momento del sismo, en «Lo que encontramos» (la sección que cierra la Entrega 2), con el antes y el después del
  movimiento de las que quedaron: la magnitud pasa de 0,214 a 0,590 y la profundidad sale del rojo (0,051 → 0,216) en los sismos de
  M6 o más. «Los datos» queda sólo con el filtro de fuga, y el paso 4 del modelo, con una idea: el modelo confirma el semáforo.
  Una primera versión ponía las tres medidas sobre una regla común, con puntos huecos y llenos: no se entendía. Quedó como una
  tabla de cuadrados del color del semáforo con el valor adentro: «todas las secuencias» → movimiento 1 («sólo M6 o
  más») → movimiento 2 («M6 o más y someros», sólo la magnitud).
  La profundidad muestra sus dos movimientos (tres franjas con η², que sigue en rojo, y sólo M6 o más). Debajo, un gráfico de
  apoyo sin medidas: de cada 100 sismos de cada grupo, cuántos dejan ninguna, pocas, moderadas o muchas réplicas, antes y
  después de cada movimiento, para que se entienda sin saber qué es Spearman.
  Las otras 12 columnas salieron del gráfico del semáforo: no se exploraron con movimientos sino probándolas directamente en el
  modelo (paso 4), y mostrarlas como «en rojo, sin movimiento» daba a entender que no se habían probado.
  El gráfico de cuadrados de «Los datos» pasa a ser un embudo de verdad, centrado y que se angosta (27 → 15 → 3), con cada grupo que sale a la
  derecha y su propio tooltip, que se lee
  sin pasar el mouse; ahí cuenta qué columnas existen y cuáles pueden entrar,
  y el semáforo de «Lo que encontramos» se queda sólo con las tres que sirvieron, para no perder el foco.
  Cada bloque del semáforo y del gráfico de apoyo lleva de título la hipótesis de la Entrega 2 (H1, H3): sin ella no se entendía
  qué se estaba buscando.
- **El gráfico de apoyo, más simple.** Los seis paneles de barras apiladas no se entendían a simple vista. Quedó un solo número
  por grupo: de cada 100 sismos, cuántos dejan más de 10 réplicas.
- **Mapa del Cinturón de Fuego en «Los datos».** Explica por qué esas cinco regiones: son zonas de subducción del cinturón, donde
  ocurre la mayoría de los sismos grandes. Cada región va recuadrada con el rectángulo exacto de su consulta a USGS.
- **La importancia por permutación pasa al tallo de «El modelo».** Estaba en «Cómo lo sabemos» como «cuánto baja el f1». Ahora
  muestra el f1 que queda (con todo, y desordenando cada columna) contra la línea del piso: desordenando la magnitud, el modelo
  cae casi al piso, que es lo que se quería mostrar.
- **Los pasos del modelo, con la decisión en el título y dos líneas de texto.** Los números que había en cada párrafo pasaron a
  «Los números de cada paso», en «Cómo lo sabemos». El gráfico del paso 2 (tres sismos inventados con lo que contesta Poisson)
  explicaba cómo funciona Poisson pero no la decisión: lo reemplaza el f1 de la logística contra Poisson, con el piso.
- **«Las dos variables», simplificado.** El mapa de colores de magnitud × profundidad con los sismos de entrenamiento encima era
  confuso. Quedan tres franjas (30, 100 y 300 km) con lo que contesta el modelo a lo largo de la magnitud sobre el umbral.
  Después pasó a «Cómo lo sabemos» del modelo: en el tallo, la importancia por permutación ya cuenta que el modelo se apoya en
  la magnitud, y se entiende sin explicación.
  Al final se sacó: no aportaba a la historia, y la importancia por permutación ya muestra que el modelo se apoya en la magnitud
  mucho más que en la profundidad.
- **«Lo que encontramos», reordenado.** El tallo cuenta la historia sin medidas: el hallazgo principal, las barras «de cada 100
  secuencias» con la H1 y la H3 en palabras, y los atípicos al final como el «pero». El semáforo (Spearman, η², movimientos) pasó a
  «Cómo lo sabemos», que es donde la consigna pide las hipótesis con su número; en el tallo era el notebook con otra ropa.
- **Las decisiones del proyecto, en el lugar donde pasaron.** Los problemas que tuvimos estaban escondidos en «Cómo lo sabemos». Un
  primer intento los juntó en bloques de tarjetas (problema → decisión → resultado), pero se leían como un listado aparte. Quedó un
  aviso de una línea, «Problema: …», justo antes de la parte que lo resuelve, y lo que sigue empieza con la decisión: una sola región
  no alcanzaba → el mapa de las cinco regiones; el principal como el sismo más grande era fuga → después del embudo de «Los datos»,
  «Por eso el principal es el sismo que abre la secuencia» (su costo son los triángulos de los atípicos); sismos parecidos dejan cantidades muy distintas → paso 1 (intervalo); el error dependía de la
  región → paso 3 (magnitud sobre el umbral). Los números del primer análisis son del notebook de los Andes (celdas 13, 90 y 104).
- **«Los datos», reordenado.** Después del gráfico principal va primero de dónde salen los datos (el problema de los Andes y el
  mapa de las cinco regiones), después qué columnas se pueden usar (el gráfico de columnas) y al final el problema de fuga del sismo principal,
  al lado de ese gráfico, que también habla de fuga. Así los dos avisos de problema no quedan seguidos.
- **El título de «Lo que encontramos».** Era «Las réplicas crecen con la magnitud: de 0,2 de media en los sismos que apenas superan
  el umbral a 128 en los que lo superan por 2,5 a 3,0 puntos»: largo, técnico y repetía el título de las barras. Ahora afirma lo que
  muestra el gráfico, la forma del crecimiento: «Las réplicas no crecen de a poco con la magnitud: se multiplican». Los números
  pasaron al texto de debajo.
- **El sismo principal, en rojo en el globo.** Al animar una secuencia, todos los eventos iban con el color de la clase y no se
  distinguía el principal de sus réplicas. Ahora el principal (el primer evento: el que abre la secuencia) va en rojo
  (`COLOR_PRINCIPAL` en `palette.py`) y se dibuja encima de las réplicas; la leyenda lo nombra mientras hay una secuencia animada.
  El rojo no es una clase ni un acento: sólo aparece en el globo.
  Si en la secuencia hay un sismo posterior mayor que el principal, el más grande va en amarillo claro (`COLOR_MAYOR`), también
  encima de las réplicas, y la leyenda lo nombra sólo cuando existe; el punto del aviso «Luego hubo un M…, mayor que el principal»
  usa el mismo amarillo.
- **Las columnas, de embudo a recuadros.** El embudo (franjas de 27, 15 y 3 de ancho unidas por estrechamientos) se leía como
  una escalera invertida: la forma pesaba más que los números, y no se veía qué columna salía en cada paso. Ahora son tres filas
  del mismo ancho con un recuadro por columna, que no cambia de lugar de una fila a otra: lleno = sigue, sólo el borde = ya salió.
  Los recuadros van agrupados por el motivo de salida, con una llave y «n motivo» debajo de la última fila, y las tres del modelo
  van en verde liquen en las tres filas para seguirlas. Se descartó dibujar tres rectángulos separados de 27, 15 y 3 recuadros:
  volvía la escalera y se perdía cuáles salen y por qué.
