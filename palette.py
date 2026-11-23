"""Paleta única de la app. La usan los gráficos de Altair y el globo (vía palette.json).
Los valores salen del design system «Sisimia Estratos», tema basalto (oscuro): la interfaz es marrón monocroma y el
color vivo es dato. Los neutros de los gráficos viven acá, no en el CSS (que repite los mismos tokens).

Daltonismo: cada par de colores que comparte un gráfico se validó simulando protanopía, deuteranopía y tritanopía
(Machado 2009). La separación viene de la luminosidad, no sólo del tono; además del color, los gráficos usan forma
(círculo, triángulo, cuadrado; lleno o hueco) o rótulo directo."""
CLASES = ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"]
# rampa de tierra ordinal: piedra → ocre → óxido → arena clara. Cuantas más réplicas, más luminosa (más contraste sobre
# el fondo oscuro). Entre las cuatro, ΔE OKLab ≥ 9 con cualquier daltonismo simulado; todas ≥ 3:1 sobre FONDO_GRAFICO.
COLOR_CLASE = ["#746a61", "#aa843f", "#ff9262", "#ffd7b0"]
# partición de los datos: misma codificación en todos los gráficos (veta-fuerte y tinta: difieren en luminosidad)
COLOR_PARTICION = {"entrenamiento": "#7d6853", "test": "#f0e4d3"}
# fuera de las clases, dos acentos con significado fijo en todos los gráficos. No comparten gráfico con los colores de
# las clases, así que no se confunden con ellas. Entre sí, ΔE ≥ 12 con cualquier daltonismo (difieren en luminosidad).
#   verde liquen   = lo que se adoptó, lo que usa el modelo, el modelo elegido (único tono frío del sistema)
#   rosa de tierra = lo que se probó y se descartó (lo que no puede entrar al modelo va en el neutro)
COLOR_ELEGIDO = "#7cc0bd"
COLOR_DESCARTE = "#c66f76"
COLOR_NEUTRO = "#7d6853"
# el semáforo de la Entrega 2: sólo en el gráfico del semáforo, con la zona escrita en cada celda. Rojo y verde no se
# distinguen con daltonismo: la palabra escrita en cada celda es la que lleva la información, no el color.
COLOR_SEMAFORO = {"rojo": "#c94c4c", "amarillo": "#d4a72c", "verde": "#3f9b5a"}
COLOR_DATOS = "#f0e4d3"
# el sismo principal en el globo, cuando se anima una secuencia: azul, fuera de la rampa de tierra para distinguirlo de
# sus réplicas (que van con el color de su clase; ΔE ≥ 21 contra todas, con cualquier daltonismo). La leyenda lo nombra.
COLOR_PRINCIPAL = "#2ca2ff"
# si en la secuencia hay un sismo mayor que el principal (vino después), ese evento va en blanco: ΔE ≥ 11 contra las
# clases y ≥ 30 contra el azul del principal, con cualquier daltonismo. También sólo en el globo.
COLOR_MAYOR = "#ffffff"

# neutros de los gráficos sobre el fondo oscuro (la «placa» donde se apoya cada gráfico)
FONDO_GRAFICO = "#211912"   # placa
TEXTO_GRAFICO = "#c6b39d"   # tinta-suave
TEXTO_FUERTE = "#f0e4d3"    # tinta
GRILLA = "#45362a"          # veta
EJE = "#7d6853"             # veta-fuerte
OCEANO = "#16110d"          # suelo: la esfera del mapa del Cinturón de Fuego
TIERRA = "#3a2c20"          # horizonte-1: los continentes del mapa
BORDE_TIERRA = "#4e3a29"    # horizonte-2: su contorno
# el Cinturón de Fuego en el mapa: arcilla a 0,45 de opacidad (queda en L 0,45–0,51), lejos del verde liquen de los
# recuadros de las regiones (L 0,76): ΔE ≥ 25 con cualquier daltonismo
COLOR_CINTURON = "#e2946a"
# texto encima de un relleno: sobre el neutro del embudo (claro en basalto; en loess, oscuro, ver TEMA_CLARO) y sobre el
# amarillo del semáforo (oscuro en los dos temas: no está en TEMA_CLARO)
TEXTO_SOBRE_NEUTRO = "#fffffe"
TEXTO_SOBRE_AMARILLO = "#1d1610"

# Tema claro (loess). Los specs se generan en basalto; la app, con el tema claro elegido, cambia cada color de esta tabla
# por su par de loess al dibujar (Grafico.jsx). Lo que no está en la tabla (semáforo, sismo principal y mayor) no cambia.
# El globo es el espacio: queda oscuro en los dos temas y no usa esta tabla.
# Validados como los de basalto: clases ΔE ≥ 9, elegido/descarte ≥ 11 y elegido/neutro ≥ 10 con cualquier daltonismo. El
# neutro de los gráficos es más claro que veta-fuerte del CSS (#87694d) para separarse del verde liquen con protanopía.
TEMA_CLARO = {
    COLOR_CLASE[0]: "#968979", COLOR_CLASE[1]: "#9f6700", COLOR_CLASE[2]: "#903303", COLOR_CLASE[3]: "#561811",
    COLOR_ELEGIDO: "#2d6a6c", COLOR_DESCARTE: "#71232f",
    COLOR_NEUTRO: "#9e7f63",        # también EJE y la partición «entrenamiento» (mismo valor en basalto)
    TEXTO_FUERTE: "#2b1e15",        # tinta; también COLOR_DATOS y la partición «test»
    TEXTO_GRAFICO: "#5c4838",       # tinta-suave
    FONDO_GRAFICO: "#f6efe3",       # placa
    GRILLA: "#c7b293",              # veta
    OCEANO: "#ece1cf", TIERRA: "#d9c6a8", BORDE_TIERRA: "#c4a37c",
    COLOR_CINTURON: "#8f3f1d",      # arcilla de loess
    TEXTO_SOBRE_NEUTRO: "#1a120c",
}
assert len({k.lower() for k in TEMA_CLARO}) == len(TEMA_CLARO), "dos colores de basalto con el mismo valor: el tema claro no los distinguiría"
