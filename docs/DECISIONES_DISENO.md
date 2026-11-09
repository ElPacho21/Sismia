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
