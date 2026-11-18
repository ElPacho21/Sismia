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
