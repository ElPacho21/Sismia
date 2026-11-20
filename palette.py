"""Paleta única de la app. La usan los gráficos de Altair y el globo (vía palette.json).
Los colores de las clases son los mismos que ya usaba el notebook de la Entrega 3 y no cambian con el tema.
El tema es oscuro («sala de registro sísmico»): los neutros de los gráficos viven acá, no en el CSS."""
CLASES = ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"]
COLOR_CLASE = ["#7a7974", "#2a78d6", "#d6762a", "#1f9e6b"]
# partición de los datos: misma codificación en todos los gráficos
COLOR_PARTICION = {"entrenamiento": "#5d6d8a", "test": "#e8edf5"}
# fuera de las clases, dos acentos con significado fijo en todos los gráficos (validados con scripts de la guía de
# visualización sobre el fondo de los gráficos: entre sí se distinguen también con daltonismo). No comparten gráfico
# con los colores de las clases, así que no se confunden con ellas.
#   azul verdoso = lo que se adoptó, lo que usa el modelo, el modelo elegido
#   rosa         = lo que se probó y se descartó (lo que no puede entrar al modelo va en gris)
COLOR_ELEGIDO = "#19a4b7"
COLOR_DESCARTE = "#d15d7d"
COLOR_NEUTRO = "#8593ab"
COLOR_DATOS = "#dbe3f0"
# el sismo principal en el globo, cuando se anima una secuencia: rojo, para distinguirlo de sus réplicas (que van con el
# color de su clase). No es una clase ni un acento: sólo aparece en el globo, y la leyenda lo nombra.
COLOR_PRINCIPAL = "#ff3b3b"
# si en la secuencia hay un sismo mayor que el principal (vino después), ese evento va en amarillo claro: se distingue del
# rojo del principal y, sobre el fondo oscuro, del naranja de «moderadas». También sólo en el globo.
COLOR_MAYOR = "#ffe14d"

# neutros de los gráficos sobre el fondo oscuro (la «placa» donde se apoya cada gráfico)
FONDO_GRAFICO = "#111a2b"
TEXTO_GRAFICO = "#b7c3d6"
TEXTO_FUERTE = "#e8edf5"
GRILLA = "#202e47"
EJE = "#566890"
