"""Gráficos de Sisimia, todos con Altair.

Cada función devuelve un gráfico; build_app.py los guarda como especificaciones
Vega-Lite (JSON) en app/public/specs/ y la página los dibuja con vega-embed.
La tabla componente por componente de cada uno está en docs/GRAFICOS.md.

Regla de color (una sola paleta, en palette.py):
  * el color de las cuatro clases SIEMPRE es la clase de réplicas (ninguna / pocas / moderadas / muchas): donde el
    gráfico muestra secuencias o cantidades de réplicas, se pintan por su clase;
  * lo que no es una clase usa dos acentos fijos: verde liquen = lo adoptado / lo que usa el modelo; rosa = lo
    descartado tras probarlo. Lo demás (también lo que no puede entrar al modelo), en grises; los grupos de casos, con la forma.
"""
import json

import altair as alt
import numpy as np
import pandas as pd

from palette import (CLASES, COLOR_CLASE, COLOR_DATOS, COLOR_DESCARTE, COLOR_ELEGIDO, COLOR_NEUTRO, COLOR_PARTICION,
                     COLOR_SEMAFORO, EJE, FONDO_GRAFICO, GRILLA, OCEANO, TEXTO_FUERTE, TEXTO_GRAFICO, TIERRA,
                     BORDE_TIERRA, COLOR_CINTURON, TEXTO_SOBRE_AMARILLO, TEXTO_SOBRE_NEUTRO)

alt.data_transformers.disable_max_rows()

# la misma escala de color en todos los gráficos
ESCALA_CLASE = alt.Scale(domain=CLASES, range=COLOR_CLASE)
CORTE_ALTO = 2.5            # tramo (+2,5 a +3,0 sobre el umbral) que el título de H1 cita; se lee directo en el gráfico
# tipografías del design system Estratos: Alegreya para el relato; IBM Plex Mono para lo que lee un instrumento (las
# cifras de los ejes cuantitativos, que así quedan alineadas y sin los números de estilo antiguo de Alegreya)
FUENTE = "'Alegreya Variable', Alegreya, 'Palatino Linotype', Georgia, serif"
FUENTE_MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace"


def es(valor, decimales=0):
    """Número con formato español: 21.292 y 0,50."""
    texto = f"{valor:,.{decimales}f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def estilo(chart):
    return (chart.configure(font=FUENTE, background=FONDO_GRAFICO)
            .configure_axis(labelFontSize=13, titleFontSize=13, grid=True, gridColor=GRILLA, domainColor=EJE,
                            tickColor=EJE, labelColor=TEXTO_GRAFICO, titleColor=TEXTO_GRAFICO)
            .configure_axisQuantitative(labelFont=FUENTE_MONO, labelFontSize=12)
            .configure_view(stroke=None)
            .configure_title(fontSize=13, fontWeight=600, color=TEXTO_FUERTE, anchor="start", offset=10)
            .configure_header(labelFontSize=13, labelColor=TEXTO_FUERTE, titleFontSize=13, titleColor=TEXTO_GRAFICO)
            .configure_legend(labelFontSize=13, titleFontSize=13, labelColor=TEXTO_GRAFICO, titleColor=TEXTO_GRAFICO,
                              symbolFillColor=TEXTO_GRAFICO))


# =================================================================== 1. LOS DATOS
def grafico_datos(df):
    """Cuántas secuencias hay en cada intervalo de réplicas."""
    from referencia_sklearn import a_intervalo
    t = pd.Series(a_intervalo(df["n_aftershocks"])).value_counts().reindex(CLASES).rename_axis("clase").reset_index(
        name="secuencias")
    t["porcentaje"] = t["secuencias"] / t["secuencias"].sum() * 100
    base = alt.Chart(t).encode(
        y=alt.Y("clase:N", sort=CLASES, title=None, axis=alt.Axis(labelLimit=220)),
        x=alt.X("secuencias:Q", title="Secuencias (cada una es un sismo principal y sus réplicas)",
                scale=alt.Scale(zero=True), axis=alt.Axis(format=",.0f")))
    barras = base.mark_bar().encode(
        color=alt.Color("clase:N", scale=ESCALA_CLASE, legend=None),
        tooltip=[alt.Tooltip("clase:N", title="Réplicas"), alt.Tooltip("secuencias:Q", title="Secuencias", format=","),
                 alt.Tooltip("porcentaje:Q", title="%", format=".1f")])
    # el número va a la derecha de cada barra; las barras chicas quedan legibles
    texto = base.mark_text(align="left", dx=6, fontSize=13).encode(
        text=alt.Text("etiqueta:N"), color=alt.value(TEXTO_FUERTE)).transform_calculate(
        etiqueta="format(datum.secuencias, ',') + '  (' + format(datum.porcentaje, '.1f') + ' %)'")
    return (barras + texto).properties(width=560, height=170)


# los grupos, en el orden en que se lee el gráfico: de lo que sale primero a lo que llega al modelo
GRUPOS_COLUMNAS = ["Identifican la secuencia", "Son la respuesta", "Fuga: se saben cuando la secuencia terminó",
                   "Constantes en este dataset", "Se probaron en el modelo y no mejoraron", "Usa el modelo"]


# por qué sale cada grupo del embudo, en una línea (va en el tooltip)
POR_QUE_SALE = {
    GRUPOS_COLUMNAS[0]: "Sirven para identificar o para ordenar la secuencia, no dicen nada del sismo.",
    GRUPOS_COLUMNAS[1]: "Son lo que queremos predecir.",
    GRUPOS_COLUMNAS[2]: "Fuga: se saben recién cuando la secuencia terminó, no en el momento del sismo.",
    GRUPOS_COLUMNAS[3]: "En este dataset tienen el mismo valor en todas las filas.",
    GRUPOS_COLUMNAS[4]: "Existen en el momento del sismo, pero agregadas al modelo, de a una o todas juntas, no lo mejoran (paso 4 de «El modelo»).",
}
SALIDA_CORTA = {GRUPOS_COLUMNAS[0]: "identifican la secuencia", GRUPOS_COLUMNAS[1]: "son la respuesta",
                GRUPOS_COLUMNAS[2]: "son fuga: se saben cuando terminó", GRUPOS_COLUMNAS[3]: "valen siempre lo mismo",
                GRUPOS_COLUMNAS[4]: "se probaron en el modelo y no lo mejoraron"}


def grafico_columnas(inventario):
    """El embudo de las columnas: todas las del dataset → las que existen en el momento del sismo → las que usa el
    modelo. El ancho de cada franja es la cantidad de columnas; a la derecha de cada estrechamiento, qué grupos salen
    y por qué (el tooltip de cada grupo dice cuáles son)."""
    t = inventario
    grupos = {g: t.loc[t["grupo"] == g, "columna"].tolist() for g in GRUPOS_COLUMNAS}
    n = [len(t), len(t) - sum(len(grupos[g]) for g in GRUPOS_COLUMNAS[:4]), len(grupos[GRUPOS_COLUMNAS[5]])]
    # alturas: franja, estrechamiento, franja, estrechamiento, franja (de arriba hacia abajo)
    F, E1, E2 = 0.9, 1.9, 1.0
    y0 = [0, F + E1, F + E1 + F + E2]
    nombres_usa = ", ".join(NOMBRE_USADAS[c] for c in ("mainshock_mag", "region_mc", "mainshock_depth"))
    rotulos = [f"{n[0]} columnas en el dataset", f"{n[1]} existen en el|momento del sismo",
               f"{n[2]} usa el modelo"]
    cuales = [", ".join(t["columna"]), ", ".join(t.loc[t["grupo"].isin(GRUPOS_COLUMNAS[4:]), "columna"]),
              ", ".join(grupos[GRUPOS_COLUMNAS[5]]) + f" ({nombres_usa})"]
    colores = [COLOR_NEUTRO, COLOR_NEUTRO, COLOR_ELEGIDO]

    # la silueta del embudo: cada tramo es un área entre el borde izquierdo y el derecho (x, x2) a lo largo de y
    puntos = []
    for k in range(3):
        for yy in (y0[k], y0[k] + F):                       # franja de ancho constante
            puntos.append({"tramo": f"franja {k}", "y": yy, "x": -n[k] / 2, "x2": n[k] / 2, "color": colores[k],
                           "opacidad": 1.0, "paso": rotulos[k], "cuales": cuales[k]})
        if k < 2:                                            # estrechamiento hasta la franja siguiente
            for yy, w in ((y0[k] + F, n[k]), (y0[k + 1], n[k + 1])):
                puntos.append({"tramo": f"estrecha {k}", "y": yy, "x": -w / 2, "x2": w / 2, "color": COLOR_NEUTRO,
                               "opacidad": 0.35, "paso": "", "cuales": ""})
    silueta = pd.DataFrame(puntos)
    x = alt.Scale(domain=[-n[0] / 2 - 0.5, 38], nice=False)
    y = alt.Scale(domain=[-0.15, y0[2] + F + 0.15], reverse=True, nice=False)
    forma = alt.Chart(silueta).mark_area(orient="horizontal", interpolate="linear").encode(
        y=alt.Y("y:Q", scale=y, axis=None), x=alt.X("x:Q", scale=x, axis=None), x2="x2:Q",
        detail="tramo:N", color=alt.Color("color:N", scale=None), opacity=alt.Opacity("opacidad:Q", scale=None),
        tooltip=[alt.Tooltip("paso:N", title="Paso"), alt.Tooltip("cuales:N", title="Columnas")])
    franjas = pd.DataFrame({"y": [v + F / 2 - (0.12 if "|" in r else 0) for v, r in zip(y0, rotulos)], "rotulo": rotulos, "n": n})
    # el rótulo de la última franja no entra adentro: va a la derecha, con las tres columnas
    texto_franjas = alt.Chart(franjas[franjas["n"] > 5]).mark_text(fontSize=14, fontWeight=700, color=TEXTO_SOBRE_NEUTRO,
                                                                   lineBreak="|", lineHeight=17).encode(
        y=alt.Y("y:Q", scale=y), x=alt.X("cero:Q", scale=x), text="rotulo:N").transform_calculate(cero="0")
    ultima = pd.DataFrame({"y": [y0[2] + F / 2], "x": [n[2] / 2 + 1], "t": [f"{n[2]} usa el modelo: {nombres_usa}"]})
    texto_ultima = alt.Chart(ultima).mark_text(align="left", fontSize=14, fontWeight=700, color=COLOR_ELEGIDO).encode(
        y=alt.Y("y:Q", scale=y), x=alt.X("x:Q", scale=x), text="t:N")

    # las salidas, a la derecha de cada estrechamiento: una línea por grupo
    salidas = []
    medio1 = F + E1 / 2
    for i, g in enumerate(GRUPOS_COLUMNAS[:4]):
        salidas.append({"y": medio1 + (i - 1.5) * 0.42, "grupo": g, "n": len(grupos[g]), "color": TEXTO_GRAFICO})
    salidas.append({"y": y0[1] + F + E2 / 2, "grupo": GRUPOS_COLUMNAS[4], "n": len(grupos[GRUPOS_COLUMNAS[4]]),
                    "color": COLOR_DESCARTE})
    s_ = pd.DataFrame(salidas)
    s_["t"] = "→  " + s_["n"].astype(str) + " " + s_["grupo"].map(SALIDA_CORTA)
    s_["por_que"] = s_["grupo"].map(POR_QUE_SALE)
    s_["cuales"] = s_["grupo"].map(lambda g: ", ".join(grupos[g]))
    X_SALIDA = n[0] / 2 + 1
    texto_salidas = alt.Chart(s_).mark_text(align="left", fontSize=13, fontWeight=600).encode(
        y=alt.Y("y:Q", scale=y), x=alt.value(0), text="t:N", color=alt.Color("color:N", scale=None),
        tooltip=[alt.Tooltip("t:N", title="Salen"), alt.Tooltip("cuales:N", title="Columnas"),
                 alt.Tooltip("por_que:N", title="Por qué")]).transform_calculate(xs=str(X_SALIDA)).encode(
        x=alt.X("xs:Q", scale=x))
    return alt.layer(forma, texto_franjas, texto_ultima, texto_salidas).properties(width=640, height=330)


# nombres en castellano de las tres columnas que usa el modelo (las otras doce están en NOMBRE_COLUMNA, más abajo)
NOMBRE_USADAS = {"mainshock_mag": "magnitud", "mainshock_depth": "profundidad",
                 "region_mc": "umbral de detección de la región"}
ZONAS = ["rojo", "amarillo", "verde"]
SIGNIFICADO_ZONA = {"rojo": "rojo: no se mueve con las réplicas", "amarillo": "amarillo: se mueve, pero no del todo",
                    "verde": "verde: se mueve claramente con las réplicas"}


def valor_semaforo(valor, medida):
    """El número que va adentro del cuadrado: tres decimales, y «< 0,001» para los η² que dan prácticamente cero."""
    if abs(valor) < 0.0005:
        return "< 0,001"
    return es(valor, 3)


# qué afirmábamos en la Entrega 2 sobre cada columna que usa el modelo, y qué pasó con eso
HIPOTESIS_COLUMNA = {
    "mainshock_mag": ("H1 · «Las réplicas crecen con la magnitud»",
                      "Se sostuvo: arranca en amarillo y, en los sismos grandes y someros, queda en el borde del verde."),
    "mainshock_depth": ("H3 · «Los sismos someros (menos de 70 km) dejan más réplicas que los profundos»",
                        "Con todos los sismos, no (rojo, aun en 3 franjas); entre los de M6 o más, sí (amarillo)."),
    "region_mc": ("Umbral de detección de la región: sin hipótesis propia",
                  "Solo no se mueve; entra restado a la magnitud porque corrige un sesgo entre regiones (paso 3 de «El modelo»)."),
}

# cómo se nombra cada movimiento adentro de una celda (tiene que entrar en el cuadrado)
CORTO = {"tres franjas de profundidad": "en 3 franjas"}


def grafico_semaforo(sem):
    """La tabla de columnas candidatas de la Entrega 2, como cuadrados del color del semáforo: una fila por cada una
    de las tres columnas que usa el modelo; a la izquierda, la medida sobre todas las secuencias; a la
    derecha, después de cada movimiento de las dos que se movieron (cada celda dice cuál fue)."""
    # las tres columnas de la tabla (antes, movimiento 1, movimiento 2), en posiciones fijas: x cuantitativa sin eje, así
    # entran las flechas entre una y otra
    POS, ANCHO_CELDA = [0.0, 1.45, 2.9], 1.15
    ANTES, ANCHO = POS[0], 520
    x = alt.Scale(domain=[0, POS[-1] + ANCHO_CELDA], nice=False, zero=False)
    color = alt.Color("zona:N", scale=alt.Scale(domain=ZONAS, range=[COLOR_SEMAFORO[z] for z in ZONAS]), legend=None)
    eje_y = dict(title=None, axis=alt.Axis(labelLimit=300, grid=False, domain=False, ticks=False, labelFontSize=13,
                                           labelColor=TEXTO_FUERTE, minExtent=140, maxExtent=140))
    medida_txt = {"spearman": "Spearman", "η²": "η²", "separación": "separación"}

    def celdas(filas_):
        t = pd.DataFrame(filas_)
        t["x2"] = t["x"] + ANCHO_CELDA
        t["xm"] = t["x"] + ANCHO_CELDA / 2
        t["texto"] = [valor_semaforo(v, m) for v, m in zip(t["valor"], t["medida"])]
        t["significado"] = t["zona"].map(SIGNIFICADO_ZONA)
        return t

    def bloque(filas_, orden, titulo, color_titulo, notas=None, flechas=None, alto_fila=34, subtitulo=None):
        t = celdas(filas_)
        y = alt.Y("fila:N", sort=orden, **eje_y)
        capas = [
            alt.Chart(t).mark_rect(cornerRadius=3, stroke=FONDO_GRAFICO, strokeWidth=3, opacity=0.9).encode(
                x=alt.X("x:Q", scale=x, axis=None), x2="x2:Q", y=y, color=color,
                tooltip=[alt.Tooltip("fila:N", title="Columna"), alt.Tooltip("etapa:N", title="Sobre"),
                         alt.Tooltip("medida_nombre:N", title="Medida"), alt.Tooltip("texto:N", title="Valor"),
                         alt.Tooltip("significado:N", title="Zona")]),
            alt.Chart(t).mark_text(fontSize=12, fontWeight=700, lineBreak="|", lineHeight=15).encode(
                x=alt.X("xm:Q", scale=x, axis=None), y=y, text="rotulo:N",
                color=alt.condition("datum.zona == 'amarillo'", alt.value(TEXTO_SOBRE_AMARILLO), alt.value("#ffffff"))),
        ]
        if flechas:
            capas.append(alt.Chart(pd.DataFrame(flechas)).mark_text(fontSize=20, color=TEXTO_FUERTE).encode(
                x=alt.X("x:Q", scale=x, axis=None), y=y, text="t:N"))
        if notas:
            capas.append(alt.Chart(pd.DataFrame(notas)).mark_text(align="left", fontSize=11, color=TEXTO_GRAFICO,
                                                                 lineBreak="|").encode(
                x=alt.X("x:Q", scale=x, axis=None), y=y, text="t:N"))
        return alt.layer(*capas).properties(width=ANCHO, height=alto_fila * len(orden),
                                            title=alt.TitleParams(titulo, color=color_titulo, fontSize=13,
                                                                  subtitle=subtitulo or "", subtitleColor=TEXTO_GRAFICO,
                                                                  subtitleFontSize=12))

    def fila(nombre, etapa, x0, d, debajo=None):
        # `debajo`: la segunda línea de la celda (qué medida es, o qué movimiento se hizo)
        rotulo = f"{valor_semaforo(d['valor'], d['medida'])} · {d['zona']}" + (f"|{debajo}" if debajo else "")
        return {"fila": nombre, "etapa": etapa, "x": x0, "valor": d["valor"], "medida": d["medida"],
                "medida_nombre": medida_txt[d["medida"]], "zona": d["zona"], "rotulo": rotulo}

    # encabezado: los nombres de las tres columnas de la tabla
    cab = pd.DataFrame({"x": [p + ANCHO_CELDA / 2 for p in POS], "fila": [""] * 3,
                        "t": ["Antes:|todas las secuencias", "Movimiento 1", "Movimiento 2"]})
    encabezado = alt.Chart(cab).mark_text(fontSize=13, fontWeight=700, color=TEXTO_FUERTE, lineBreak="|", lineHeight=16).encode(
        x=alt.X("x:Q", scale=x, axis=None), y=alt.Y("fila:N", **eje_y), text="t:N").properties(width=ANCHO, height=36)

    # las que usa el modelo: antes y después de cada movimiento que tuvo (la magnitud y la profundidad, dos cada una)
    mov = sem["movimientos"]
    por_col = {c["columna"]: c for c in sem["columnas"]}
    nombre = {"mainshock_mag": "magnitud", "mainshock_depth": "profundidad", "region_mc": "umbral de la región"}
    filas_usa, flechas, notas = [], [], []
    for c in sem["usa_el_modelo"]:
        if c in mov:
            for i, e in enumerate(mov[c]):
                debajo = medida_txt[e["medida"]] if i == 0 else CORTO.get(e["etapa"], e["etapa"]) + (
                    f" ({medida_txt[e['medida']]})" if e["medida"] != mov[c][0]["medida"] else "")
                filas_usa.append(fila(nombre[c], e["etapa"], POS[i], e, debajo))
                if i:
                    flechas.append({"fila": nombre[c], "x": (POS[i - 1] + ANCHO_CELDA + POS[i]) / 2, "t": "→"})
        else:
            filas_usa.append(fila(nombre[c], "todas las secuencias", ANTES, por_col[c], medida_txt[por_col[c]["medida"]]))
    # un bloque por hipótesis de la Entrega 2: el título dice qué afirmábamos y el subtítulo, qué pasó
    bloques = []
    for c, (titulo, subtitulo) in HIPOTESIS_COLUMNA.items():
        bloques.append(bloque([f for f in filas_usa if f["fila"] == nombre[c]], [nombre[c]], titulo, COLOR_ELEGIDO,
                              flechas=[f for f in flechas if f["fila"] == nombre[c]] or None, alto_fila=50,
                              subtitulo=subtitulo))
    # las otras doce no van acá: se probaron directamente en el modelo (paso 4) y su tabla está en «Cómo lo sabemos»
    return alt.vconcat(encabezado, *bloques, spacing=16)


def grafico_movimientos(sem):
    """El apoyo visual del semáforo, sin medidas: de cada 100 secuencias de cada grupo, en cuántas hubo más de 10 réplicas.
    H1, por tamaño del sismo; H3, someros contra profundos, con todos los sismos y sólo con los de M6 o más."""
    t = pd.DataFrame(sem["reparto"])
    t = t[t["clase"] == CLASES[3]].copy()
    t["rotulo"] = [es(v, 1) if v < 1 else es(v) for v in t["por_cien"]]
    x = alt.Scale(domain=[0, 75], nice=False)
    MUCHAS = COLOR_CLASE[3]

    def barras(d, orden, alto, titulo=None, subtitulo=None, color_titulo=TEXTO_FUERTE, tamano=12):
        y = alt.Y("grupo:N", sort=orden, title=None, axis=alt.Axis(grid=False, domain=False, ticks=False, labelFontSize=13,
                                                                     labelColor=TEXTO_FUERTE, minExtent=110, maxExtent=110))
        base = alt.Chart(d).encode(y=y, x=alt.X("por_cien:Q", scale=x, axis=None))
        tooltip = [alt.Tooltip("grupo:N", title="Secuencias"), alt.Tooltip("sismos:Q", title="Cuántas hay", format=","),
                   alt.Tooltip("rotulo:N", title="De cada 100, con más de 10 réplicas")]
        b = base.mark_bar(color=MUCHAS, cornerRadiusEnd=3, height=22).encode(tooltip=tooltip)
        n = base.mark_text(align="left", dx=8, fontSize=14, fontWeight=700, color=TEXTO_FUERTE).encode(text="rotulo:N")
        props = {"width": 420, "height": alto * len(orden)}
        if titulo:
            props["title"] = alt.TitleParams(titulo, color=color_titulo, fontSize=tamano, subtitle=subtitulo or "",
                                             subtitleColor=TEXTO_GRAFICO, subtitleFontSize=12)
        return (b + n).properties(**props)

    H1, H3 = HIPOTESIS_COLUMNA["mainshock_mag"][0], HIPOTESIS_COLUMNA["mainshock_depth"][0]
    mag = t[t["panel"] == "magnitud"]
    h1 = barras(mag, ["M4–5", "M5–6", "M6–7", "M7 o más"], 32, H1,
                "Según la magnitud del sismo principal: cuanto más grande, más chances de muchas réplicas.", COLOR_ELEGIDO, 13)
    prof = t[t["panel"] == "profundidad"]
    orden = ["someros", "profundos"]
    todos_ = barras(prof[prof["etapa"] == "todas las secuencias"], orden, 32, "Todas las secuencias")
    grandes = barras(prof[prof["etapa"] == "sólo M6 o más"], orden, 32, "Sólo las secuencias con un sismo principal de M6 o más")
    h3 = alt.vconcat(todos_, grandes, spacing=14).properties(title=alt.TitleParams(
        H3, color=COLOR_ELEGIDO, fontSize=13, subtitleColor=TEXTO_GRAFICO, subtitleFontSize=12,
        subtitle="Según la profundidad del sismo principal. Con todas, las dos casi no tienen réplicas; entre las grandes, la diferencia aparece."))
    return alt.vconcat(h1, h3, spacing=30).properties(
        title=alt.TitleParams("De cada 100 secuencias, en cuántas hubo más de 10 réplicas", color=TEXTO_FUERTE, fontSize=14,
                              offset=16))


# El Cinturón de Fuego del Pacífico, trazado aproximado a mano (lon, lat): dos tramos que siguen las fosas de
# subducción del borde del Pacífico. Es una guía visual, no el límite exacto de las placas.
CINTURON = [
    [(95, 6), (100, -3), (106, -7), (115, -10), (125, -8), (135, -5), (148, -6), (158, -9), (168, -17), (-174, -20),
     (-178, -32), (176, -40), (172, -45)],
    [(126, 2), (126, 10), (121, 18), (122, 24), (129, 30), (141, 36), (146, 43), (153, 47), (162, 54), (175, 52),
     (-170, 52), (-158, 55), (-150, 60), (-138, 58), (-130, 52), (-124, 42), (-120, 34), (-112, 25), (-104, 18),
     (-94, 15), (-86, 12), (-80, 7), (-78, 2), (-81, -6), (-76, -15), (-71, -25), (-73, -38), (-75, -48), (-74, -54)],
]


def grafico_cinturon(regiones, tierra):
    """Mapa centrado en el Pacífico: el Cinturón de Fuego (trazado aproximado) y las cinco regiones del dataset,
    recuadradas con su rectángulo de la consulta a USGS (pipeline/include/sismos/regions.yaml)."""
    proyeccion = alt.Projection(type="naturalEarth1", rotate=[-160, 0, 0], scale=118, translate=[330, 175])

    def rectangulo(r, pasos=12):
        # los lados se densifican para que acompañen la curvatura de la proyección
        lo0, lo1, la0, la1 = r["min_lon"], r["max_lon"], r["min_lat"], r["max_lat"]
        lados = ([(lo0 + (lo1 - lo0) * i / pasos, la0) for i in range(pasos)] +
                 [(lo1, la0 + (la1 - la0) * i / pasos) for i in range(pasos)] +
                 [(lo1 - (lo1 - lo0) * i / pasos, la1) for i in range(pasos)] +
                 [(lo0, la1 - (la1 - la0) * i / pasos) for i in range(pasos)])
        return [list(p) for p in lados] + [[lo0, la0]]

    # anillo de afuera en sentido horario: así d3 lo toma como el rectángulo y no como «todo el planeta menos el rectángulo»
    cajas = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"nombre": r["nombre"], "secuencias": r["secuencias"]},
         "geometry": {"type": "Polygon", "coordinates": [rectangulo(r)[::-1]]}} for r in regiones]}
    linea = {"type": "Feature", "properties": {},
             "geometry": {"type": "MultiLineString", "coordinates": [[list(p) for p in tramo] for tramo in CINTURON]}}

    fondo = alt.Chart(alt.Data(values=[{"type": "Sphere"}])).mark_geoshape(fill=OCEANO, stroke=EJE, strokeWidth=0.5)
    tierra_ = alt.Chart(alt.Data(values=tierra, format=alt.DataFormat(type="topojson", feature="land"))).mark_geoshape(
        fill=TIERRA, stroke=BORDE_TIERRA, strokeWidth=0.5)
    cinturon = alt.Chart(alt.Data(values=[linea])).mark_geoshape(
        filled=False, stroke=COLOR_CINTURON, strokeWidth=14, strokeOpacity=0.45, strokeCap="round", strokeJoin="round")
    recuadros = alt.Chart(alt.Data(values=cajas["features"])).mark_geoshape(
        fill=COLOR_ELEGIDO, fillOpacity=0.18, stroke=COLOR_ELEGIDO, strokeWidth=2.2).encode(
        tooltip=[alt.Tooltip("properties.nombre:N", title="Región"),
                 alt.Tooltip("properties.secuencias:Q", title="Secuencias", format=",")])
    rotulos = pd.DataFrame([{"lon": r["rotulo_lon"], "lat": r["rotulo_lat"], "alinear": r["alinear"],
                             "t": f"{r['nombre']} · {es(r['secuencias'])} secuencias"} for r in regiones])
    texto = []
    for alinear in ("left", "right", "center"):
        texto.append(alt.Chart(rotulos[rotulos["alinear"] == alinear]).mark_text(
            align=alinear, fontSize=12, fontWeight=700, color=TEXTO_FUERTE).encode(
            longitude="lon:Q", latitude="lat:Q", text="t:N"))
    leyenda = pd.DataFrame([{"lon": -150, "lat": -12, "t": "Cinturón de Fuego del Pacífico|(trazado aproximado)"}])
    texto_cinturon = alt.Chart(leyenda).mark_text(fontSize=12, fontWeight=700, color=COLOR_CINTURON,
                                                   lineBreak="|", align="center").encode(
        longitude="lon:Q", latitude="lat:Q", text="t:N")
    return (alt.layer(fondo, tierra_, cinturon, recuadros, *texto, texto_cinturon)
            .project(**proyeccion.to_dict()).properties(width=660, height=350))


# =================================================================== 2. LO QUE ENCONTRAMOS (H1)
def tabla_h1(df, ancho=0.5, minimo=10):
    """Réplicas medias por tramo de magnitud SOBRE el umbral de su región (mag_sobre_mc)."""
    x = df["mainshock_mag"] - df["region_mc"]
    tramo = np.floor((x + 1e-9) / ancho) * ancho
    t = df.assign(tramo=tramo).groupby("tramo")["n_aftershocks"].agg(secuencias="size", media="mean").reset_index()
    t = t[t["secuencias"] >= minimo].copy()
    t["centro"] = t["tramo"] + ancho / 2
    t["rotulo"] = t["tramo"].map(lambda a: f"+{es(a, 1)} a +{es(a + ancho, 1)}")
    return t


def ajuste_h1(t):
    """Recta sobre log(media) por tramo: (pendiente, ordenada). exp(pendiente) es cuánto se multiplica por punto."""
    pendiente, ordenada = np.polyfit(t["centro"], np.log(t["media"]), 1)
    return float(pendiente), float(ordenada)


def pendiente_h1(t):
    """Cuánto se multiplican las réplicas medias por punto de magnitud (ajuste exponencial de los tramos)."""
    return float(np.exp(ajuste_h1(t)[0]))


def grafico_hallazgo(df, multiplicador_modelo):
    """Los mismos tramos con el eje vertical lineal (se ve la explosión) y logarítmico (se ve el factor constante).
    multiplicador_modelo: cuánto multiplica las réplicas cada punto de magnitud según el modelo (el número que se cita)."""
    from referencia_sklearn import a_intervalo
    t = tabla_h1(df)
    # la clase del promedio redondeado: en promedio, un sismo de este tramo deja tantas réplicas, que caen en esta clase
    t["clase"] = a_intervalo(np.round(t["media"]).astype(int))
    pendiente, ordenada = ajuste_h1(t)
    curva = pd.DataFrame({"centro": np.linspace(t["centro"].min(), t["centro"].max(), 80)})
    curva["media"] = np.exp(ordenada + pendiente * curva["centro"])
    # el eje no es la magnitud: debajo de cada valor va la magnitud aproximada, con el umbral promedio de las regiones
    mc_region = df.groupby("region")["region_mc"].first()
    mc = round(float(mc_region.mean()), 1)
    sobre = df["mainshock_mag"] - df["region_mc"]
    fuera = df.loc[sobre >= t["tramo"].max() + 0.5, "mainshock_mag"]
    x = alt.X("centro:Q", title="Magnitud sobre el umbral de su región",
              scale=alt.Scale(zero=False, nice=False, domain=[0, 3.5]),
              axis=alt.Axis(values=list(np.arange(0, 3.6, 0.5)), labelLineHeight=16,
                            labelExpr=f"['+' + format(datum.value, '.1f'), '≈ M' + format(datum.value + {mc}, '.1f')]"))
    notas = [f"0 es el umbral de cada región (de M{es(mc_region.min(), 1)} a M{es(mc_region.max(), 1)}): "
             f"el eje mide cuánto lo supera el sismo, no la magnitud."]
    if len(fuera):
        notas.append(f"Quedan fuera {len(fuera)} sismos de M{es(fuera.min(), 1)} a M{es(fuera.max(), 1)}: "
                     f"sus tramos tienen menos de 10 secuencias y su promedio no sería confiable.")
    notas.append(f"Según el modelo, cada punto de magnitud multiplica las réplicas por {es(multiplicador_modelo, 1)}.")
    tamano = alt.Size("secuencias:Q", scale=alt.Scale(type="sqrt", range=[40, 700]),
                      legend=alt.Legend(title="Secuencias en el tramo", values=[10, 100, 1000, 10000], orient="bottom",
                                        direction="horizontal"))
    tooltip = [alt.Tooltip("rotulo:N", title="Magnitud sobre el umbral"),
               alt.Tooltip("secuencias:Q", title="Secuencias", format=","),
               alt.Tooltip("media:Q", title="Réplicas medias", format=".2f")]

    def panel(logaritmico):
        if logaritmico:
            y = alt.Y("media:Q", title="Réplicas medias (escala logarítmica)",
                      scale=alt.Scale(type="log", domain=[0.1, 1000]), axis=alt.Axis(values=[0.1, 1, 10, 100, 1000], format="~g"))
            titulo = "Eje logarítmico: cada tramo multiplica al anterior"
        else:
            y = alt.Y("media:Q", title="Réplicas medias por secuencia", scale=alt.Scale(zero=True, domain=[0, 140]))
            titulo = "Eje lineal: casi plano y después se dispara"
        linea = alt.Chart(curva).mark_line(color=TEXTO_GRAFICO, strokeDash=[6, 4], strokeWidth=2).encode(x=x, y=y)
        puntos = alt.Chart(t).mark_circle(opacity=0.95, stroke=FONDO_GRAFICO, strokeWidth=1).encode(
            x=x, y=y, size=tamano, tooltip=tooltip + [alt.Tooltip("clase:N", title="Clase del promedio")],
            color=alt.Color("clase:N", scale=ESCALA_CLASE,
                            legend=alt.Legend(title="Clase del promedio (redondeado)", orient="bottom", direction="horizontal",
                                              titleLimit=300)))
        return (linea + puntos).properties(width=300, height=290, title=titulo)

    return alt.hconcat(panel(False), panel(True), spacing=36).properties(
        title=alt.TitleParams("Cómo leer el gráfico", subtitle=notas, subtitleColor=TEXTO_GRAFICO, subtitleFontSize=12,
                              fontSize=12))


GRUPO_ATIPICO = ["Resto de las secuencias", "Después vino un sismo mayor que el principal", "M7 o más con 2 réplicas o menos"]


def grafico_atipicos(datos, anotaciones):
    """Magnitud contra réplicas de todas las secuencias: el color es la clase de réplicas y la forma, el grupo
    (los dos grupos de casos atípicos)."""
    y = alt.Y("replicas:Q", title="Réplicas (escala logarítmica, con el 0)",
              scale=alt.Scale(type="symlog", constant=1, domain=[0, 5000]),
              axis=alt.Axis(values=[0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], format=",.0f"))
    x = alt.X("mag:Q", title="Magnitud del sismo principal", scale=alt.Scale(domain=[4, 9.4], nice=False))
    puntos = (alt.Chart(datos)
              .transform_calculate(
                  grupo=f"datum.mag_max > datum.mag + 1e-9 ? '{GRUPO_ATIPICO[1]}' : "
                        f"(datum.mag >= 7 && datum.replicas <= 2 ? '{GRUPO_ATIPICO[2]}' : '{GRUPO_ATIPICO[0]}')",
                  capa=f"datum.grupo == '{GRUPO_ATIPICO[0]}' ? 0 : 1",
                  # tamaño y opacidad por grupo: valores directos (sin escala ni leyenda), la leyenda la dan color y forma
                  tamano=f"datum.grupo == '{GRUPO_ATIPICO[0]}' ? 24 : datum.grupo == '{GRUPO_ATIPICO[1]}' ? 75 : 120",
                  opacidad=f"datum.grupo == '{GRUPO_ATIPICO[0]}' ? 0.6 : datum.grupo == '{GRUPO_ATIPICO[1]}' ? 0.9 : 1")
              .mark_point(filled=True, strokeWidth=1.6)
              .encode(x=x, y=y,
                      color=alt.Color("real:N", scale=ESCALA_CLASE,
                                      legend=alt.Legend(title="Réplicas", orient="bottom", direction="vertical")),
                      shape=alt.Shape("grupo:N", scale=alt.Scale(domain=GRUPO_ATIPICO, range=["circle", "triangle-up", "square"]),
                                      legend=alt.Legend(title="Secuencia", orient="bottom", direction="vertical", labelLimit=420)),
                      size=alt.Size("tamano:Q", scale=None),
                      opacity=alt.Opacity("opacidad:Q", scale=None),
                      order=alt.Order("capa:Q"),
                      tooltip=[alt.Tooltip("lugar:N", title="Lugar"), alt.Tooltip("fecha:T", title="Fecha", format="%d/%m/%Y"),
                               alt.Tooltip("mag:Q", title="Magnitud del principal"),
                               alt.Tooltip("mag_max:Q", title="Magnitud mayor de la secuencia"),
                               alt.Tooltip("prof:Q", title="Profundidad (km)"), alt.Tooltip("replicas:Q", title="Réplicas")]))
    flechas = alt.Chart(anotaciones).mark_rule(color=TEXTO_GRAFICO, strokeWidth=1).encode(
        x="mag:Q", y="replicas:Q", x2="x_texto:Q", y2="y_texto:Q")
    # el texto sale del extremo de la línea, hacia el lado que indica cada anotación
    rotulos = [alt.Chart(anotaciones).transform_filter(f"datum.alinear == '{lado}'").mark_text(
        fontSize=12, color=TEXTO_FUERTE, align=lado, baseline="middle", dx=4 if lado == "left" else -4).encode(
        x="x_texto:Q", y="y_texto:Q", text="rotulo:N") for lado in ("left", "right")]
    return alt.layer(puntos, flechas, *rotulos).properties(width=600, height=360)


# =================================================================== 3. EL MODELO
def grafico_evolucion(pasos):
    """El camino de la Entrega 3: cada paso que se probó, en orden, con su f1 macro en validación (media ± desvío).
    Lo que se adoptó va en verde liquen y unido por una línea; lo que se probó y se dejó, en rosa y hueco."""
    t = pasos.copy()
    t["bajo"], t["alto"] = t["f1"] - t["desvio"], t["f1"] + t["desvio"]
    orden = t.drop_duplicates("paso").sort_values("orden")["paso"].tolist()
    piso = float(t.loc[t["estado"] == "piso", "f1"].iloc[0])
    y = alt.Y("paso:N", sort=orden, title=None, axis=alt.Axis(labelLimit=330, grid=False, labelPadding=8))
    x = alt.Scale(domain=[0.2, 0.56], nice=False)
    tooltip = [alt.Tooltip("modelo:N", title="Modelo"), alt.Tooltip("f1:Q", title="f1 macro", format=".3f"),
               alt.Tooltip("desvio:Q", title="Desvío", format=".3f"), alt.Tooltip("nota:N", title="Qué pasó")]
    color = alt.Color("estado:N", scale=alt.Scale(domain=["piso", "se adoptó", "se probó y se dejó", "test"],
                                                  range=[TEXTO_GRAFICO, COLOR_ELEGIDO, COLOR_DESCARTE, COLOR_ELEGIDO]),
                      legend=None)
    base = alt.Chart(t).encode(y=y, color=color)
    camino = (alt.Chart(t).transform_filter("datum.estado != 'se probó y se dejó'")
              .mark_line(color=COLOR_ELEGIDO, strokeWidth=2, opacity=0.55)
              .encode(x=alt.X("f1:Q", scale=x), y=y, order="orden:Q"))
    rango = base.transform_filter("isValid(datum.desvio)").mark_rule(strokeWidth=2.5).encode(
        x=alt.X("bajo:Q", scale=x, title="f1 macro en validación temporal (media ± desvío, 5 folds)"), x2="alto:Q")
    adoptado = base.transform_filter("datum.estado != 'se probó y se dejó'").mark_point(
        filled=True, size=110, opacity=1).encode(
        x=alt.X("f1:Q", scale=x), tooltip=tooltip,
        shape=alt.Shape("estado:N", scale=alt.Scale(domain=["piso", "se adoptó", "se probó y se dejó", "test"],
                                                    range=["circle", "circle", "circle", "diamond"]),
                        legend=None))
    dejado = base.transform_filter("datum.estado == 'se probó y se dejó'").mark_point(
        filled=False, size=80, strokeWidth=1.8, opacity=1).encode(x=alt.X("f1:Q", scale=x), tooltip=tooltip)
    valor = base.transform_filter("datum.estado != 'se probó y se dejó'").mark_text(
        align="left", dx=10, dy=-10, fontSize=12, fontWeight=600).encode(
        x=alt.X("f1:Q", scale=x), text=alt.Text("f1:Q", format=".3f"))
    linea_piso = alt.Chart(pd.DataFrame({"piso": [piso]})).mark_rule(
        strokeDash=[5, 4], color=TEXTO_GRAFICO, strokeWidth=1.2).encode(x=alt.X("piso:Q", scale=x))
    return (linea_piso + camino + rango + dejado + adoptado + valor).properties(width=420, height=400)


TRAMO_EXPR = "datum.mag < 5 ? '4–5' : datum.mag < 6 ? '5–6' : datum.mag < 7 ? '6–7' : '7 o más'"


def grafico_intervalos(datos, intervalos):
    """Paso 1: las réplicas de cada sismo por tramo de magnitud (un punto por secuencia, desparramado a lo ancho),
    con la media de cada tramo. Muestra por qué no se predice el número exacto."""
    orden = list(intervalos)
    y = alt.Y("replicas:Q", title="Réplicas de la secuencia (escala logarítmica, con el 0)",
              scale=alt.Scale(type="symlog", constant=1, domain=[0, 5000]),
              axis=alt.Axis(values=[0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], format=",.0f"))
    x = alt.X("tramo:N", sort=orden, title="Magnitud del sismo principal", axis=alt.Axis(labelAngle=0, grid=False))
    puntos = (alt.Chart(datos)
              .transform_calculate(tramo=TRAMO_EXPR, desparramo="random()")
              .mark_circle(size=16, opacity=0.55)
              .encode(x=x, xOffset=alt.XOffset("desparramo:Q", scale=alt.Scale(domain=[-0.4, 1.4])), y=y,
                      color=alt.Color("real:N", scale=ESCALA_CLASE, legend=alt.Legend(title="Réplicas", orient="right")),
                      tooltip=[alt.Tooltip("lugar:N", title="Lugar"), alt.Tooltip("mag:Q", title="Magnitud"),
                               alt.Tooltip("replicas:Q", title="Réplicas")]))
    t = pd.DataFrame([{"tramo": k, **v} for k, v in intervalos.items()])
    t["rotulo_media"] = [f"media {es(m, 1)}" for m in t["media"]]
    t["rotulo_arriba"] = [f"{es(n)} sismos|varianza = {es(v)} × media" for n, v in zip(t["sismos"], t["var_media"])]
    t["arriba"] = 5000
    media = alt.Chart(t).mark_tick(color=TEXTO_FUERTE, thickness=3, size=90).encode(
        x=x, y=alt.Y("media:Q"),
        tooltip=[alt.Tooltip("tramo:N", title="Magnitud"), alt.Tooltip("sismos:Q", title="Sismos", format=","),
                 alt.Tooltip("media:Q", title="Media", format=".2f"), alt.Tooltip("var_media:Q", title="Varianza / media", format=".1f"),
                 alt.Tooltip("minimo:Q", title="Mínimo"), alt.Tooltip("maximo:Q", title="Máximo", format=",")])
    texto_media = alt.Chart(t).mark_text(align="left", dx=48, fontSize=12, fontWeight=600, color=TEXTO_FUERTE).encode(
        x=x, y="media:Q", text="rotulo_media:N")
    texto_arriba = alt.Chart(t).mark_text(fontSize=11, color=TEXTO_GRAFICO, baseline="top", lineBreak="|", lineHeight=14).encode(
        x=x, y="arriba:Q", text="rotulo_arriba:N")
    return alt.layer(puntos, media, texto_media, texto_arriba).properties(width=600, height=330)


def grafico_logistica_poisson(comparacion, f1_piso):
    """Paso 2: el f1 macro en validación de la regresión logística (y balanceada) contra la primera regresión de Poisson,
    con las mismas dos entradas (magnitud y profundidad), y la línea del piso."""
    filas = [("regresión logística", "regresión logística", "descartada"),
             ("regresión logística (balanced)", "logística, clases balanceadas", "descartada"),
             ("Poisson (mag + prof)", "regresión de Poisson", "adoptada")]
    t = pd.DataFrame([{"fila": nombre, "f1": comparacion[k][0], "desvio": comparacion[k][1], "tipo": tipo}
                      for k, nombre, tipo in filas])
    x = alt.Scale(domain=[0, 0.55], nice=False)
    y = alt.Y("fila:N", sort=t["fila"].tolist(), title=None,
              axis=alt.Axis(grid=False, domain=False, ticks=False, labelLimit=260, labelFontSize=13, labelColor=TEXTO_FUERTE))
    barras = alt.Chart(t).mark_bar(height=24, cornerRadiusEnd=3).encode(
        y=y, x=alt.X("f1:Q", scale=x, title="f1 macro en validación", axis=alt.Axis(values=[0, 0.1, 0.2, 0.3, 0.4, 0.5], format=".1f")),
        color=alt.Color("tipo:N", scale=alt.Scale(domain=["adoptada", "descartada"], range=[COLOR_ELEGIDO, COLOR_DESCARTE]), legend=None),
        tooltip=[alt.Tooltip("fila:N", title="Modelo"), alt.Tooltip("f1:Q", title="f1 macro", format=".3f"),
                 alt.Tooltip("desvio:Q", title="Desvío (5 folds)", format=".3f")])
    texto = alt.Chart(t).mark_text(align="left", dx=8, fontSize=13, fontWeight=700, color=TEXTO_FUERTE).encode(
        y=y, x=alt.X("f1:Q", scale=x), text=alt.Text("f1:Q", format=".3f"))
    piso = pd.DataFrame({"x": [f1_piso], "t": [f"piso: contestar siempre «ninguna» ({es(f1_piso, 3)})"]})
    linea = alt.Chart(piso).mark_rule(strokeDash=[5, 4], color=TEXTO_GRAFICO, strokeWidth=2).encode(x=alt.X("x:Q", scale=x))
    rotulo = alt.Chart(piso).mark_text(align="left", baseline="bottom", dx=4, dy=-4, fontSize=12, fontWeight=600,
                                       color=TEXTO_GRAFICO).encode(x=alt.X("x:Q", scale=x), y=alt.value(0), text="t:N")
    return (linea + barras + texto + rotulo).properties(width=420, height=130)


def grafico_sesgo_region(cociente, mc, nombres):
    """Paso 3: réplicas reales / esperadas por región, en validación (sin sismos de M6,5 o más), con la magnitud
    cruda y con la magnitud sobre el umbral. 1 es que el modelo acierta el total de la región."""
    versiones = {"crudo": "con la magnitud cruda", "mag_sobre_mc": "con la magnitud sobre el umbral"}
    regiones = sorted(cociente["crudo"], key=lambda r: (mc[r], r))
    rotulo = {r: f"{nombres[r]} (Mc {es(mc[r], 1)})" for r in regiones}
    t = pd.DataFrame([{"region": rotulo[r], "version": versiones[v], "valor": cociente[v][r]} for v in versiones for r in regiones])
    ancho = pd.DataFrame([{"region": rotulo[r], "desde": cociente["crudo"][r], "hasta": cociente["mag_sobre_mc"][r]} for r in regiones])
    y = alt.Y("region:N", sort=[rotulo[r] for r in regiones], title=None, axis=alt.Axis(grid=False, labelLimit=260))
    x = alt.Scale(domain=[0, 1.5])
    une = alt.Chart(ancho).mark_rule(color=TEXTO_GRAFICO, strokeWidth=2).encode(y=y, x=alt.X("desde:Q", scale=x), x2="hasta:Q")
    puntos = alt.Chart(t).mark_point(size=130, strokeWidth=2, opacity=1).encode(
        y=y, x=alt.X("valor:Q", scale=x, title="Réplicas reales / esperadas en validación"),
        color=alt.Color("version:N", scale=alt.Scale(domain=list(versiones.values()), range=[COLOR_DESCARTE, COLOR_ELEGIDO]),
                        legend=alt.Legend(title=None, orient="bottom", direction="horizontal", labelLimit=320)),
        # el relleno comparte la leyenda del color (mismo campo y mismos parámetros): queda una sola, con el hueco y el lleno
        fill=alt.Fill("version:N", scale=alt.Scale(domain=list(versiones.values()), range=["transparent", COLOR_ELEGIDO]),
                      legend=alt.Legend(title=None, orient="bottom", direction="horizontal", labelLimit=320)),
        tooltip=[alt.Tooltip("region:N", title="Región"), alt.Tooltip("version:N", title="Modelo"),
                 alt.Tooltip("valor:Q", title="Reales / esperadas", format=".2f")])
    # la magnitud cruda rotulada abajo y la corregida arriba: en los Andes los dos puntos casi se tocan
    texto = [alt.Chart(t).transform_filter(f"datum.version == '{v}'").mark_text(dy=d, fontSize=11, color=TEXTO_FUERTE).encode(
        y=y, x=alt.X("valor:Q", scale=x), text=alt.Text("valor:Q", format=".2f"))
        for v, d in ((versiones["crudo"], 16), (versiones["mag_sobre_mc"], -14))]
    uno = alt.Chart(pd.DataFrame({"x": [1], "rotulo": ["1 = acierta el total"]}))
    linea = uno.mark_rule(strokeDash=[5, 4], color=TEXTO_FUERTE).encode(x=alt.X("x:Q", scale=x))
    rotulo_uno = uno.mark_text(align="left", dx=6, dy=-6, fontSize=11, color=TEXTO_FUERTE, baseline="bottom").encode(
        x=alt.X("x:Q", scale=x), y=alt.value(0), text="rotulo:N")
    return alt.layer(linea, rotulo_uno, une, puntos, *texto).properties(width=440, height=250)


NOMBRE_COLUMNA = {"region": "región", "n_prior_30d": "sismos de los 30 días previos", "n_prior_2d": "sismos de los 2 días previos",
                  "n_prior_365d": "sismos del año previo", "prior_max_mag_365d": "magnitud mayor del año previo",
                  "days_since_prior": "días desde el sismo previo", "prior_window_truncated": "ventana del año incompleta",
                  "region_log10_eta0": "umbral η₀ de la región", "dist_to_border_km": "distancia al borde de la región",
                  "near_border": "cerca del borde de la región", "mainshock_lat": "latitud", "mainshock_lon": "longitud"}
CUANDO = ["al armar el modelo", "después, con el dataset final"]


def grafico_columnas_probadas(probadas, nuevas):
    """Paso 4: el f1 macro (media ± desvío) del modelo agregando cada columna, de a una, contra la banda de un desvío
    del modelo sin agregar nada. Una columna sirve si su punto sale de la banda por la derecha."""
    base_f1, base_sd = probadas["base"]
    filas = [{"columna": "sin agregar nada", "cuando": "base", "f1": base_f1, "desvio": base_sd, "folds": ""},
             {"columna": "+ " + NOMBRE_COLUMNA["region"], "cuando": CUANDO[0], "f1": probadas["region"][0],
              "desvio": probadas["region"][1], "folds": ""},
             {"columna": "+ " + NOMBRE_COLUMNA["n_prior_30d"], "cuando": CUANDO[0], "f1": probadas["previos"][0],
              "desvio": probadas["previos"][1], "folds": ""}]
    for c, d in nuevas["columnas"].items():
        if c != "n_prior_30d":
            filas.append({"columna": "+ " + NOMBRE_COLUMNA[c], "cuando": CUANDO[1], "f1": d["f1"], "desvio": d["desvio"],
                          "folds": f"{d['folds_mejor']} de 5"})
    t = pd.DataFrame(filas)
    t["bajo"], t["alto"] = t["f1"] - t["desvio"], t["f1"] + t["desvio"]
    orden = ["sin agregar nada"] + t[t["cuando"] != "base"].sort_values("f1", ascending=False)["columna"].tolist()
    x = alt.Scale(domain=[0.38, 0.52], nice=False)
    y = alt.Y("columna:N", sort=orden, title=None, axis=alt.Axis(grid=False, labelLimit=300))
    banda = alt.Chart(pd.DataFrame({"bajo": [base_f1 - base_sd], "alto": [base_f1 + base_sd]})).mark_rect(
        color=COLOR_ELEGIDO, opacity=0.13).encode(x=alt.X("bajo:Q", scale=x), x2="alto:Q")
    linea = alt.Chart(pd.DataFrame({"f1": [base_f1]})).mark_rule(color=COLOR_ELEGIDO, strokeDash=[5, 4]).encode(
        x=alt.X("f1:Q", scale=x))
    # color, forma y relleno comparten una sola leyenda (mismo campo y mismos parámetros)
    leyenda = alt.Legend(title="Se probó", orient="bottom", direction="horizontal", values=CUANDO, labelLimit=320)
    color = alt.Color("cuando:N", scale=alt.Scale(domain=["base"] + CUANDO, range=[COLOR_ELEGIDO, COLOR_DESCARTE, COLOR_DESCARTE]),
                      legend=leyenda)
    rango = alt.Chart(t).mark_rule(strokeWidth=2.5).encode(y=y, x=alt.X("bajo:Q", scale=x), x2="alto:Q", color=color)
    puntos = alt.Chart(t).mark_point(size=110, strokeWidth=2, opacity=1).encode(
        y=y, x=alt.X("f1:Q", scale=x, title="f1 macro en validación (media ± desvío, 5 folds)"), color=color,
        shape=alt.Shape("cuando:N", scale=alt.Scale(domain=["base"] + CUANDO, range=["circle", "square", "circle"]),
                        legend=leyenda),
        fill=alt.Fill("cuando:N", scale=alt.Scale(domain=["base"] + CUANDO, range=[COLOR_ELEGIDO, COLOR_DESCARTE, "transparent"]),
                      legend=leyenda),
        tooltip=[alt.Tooltip("columna:N", title="Columna"), alt.Tooltip("cuando:N", title="Se probó"),
                 alt.Tooltip("f1:Q", title="f1 macro", format=".3f"), alt.Tooltip("desvio:Q", title="Desvío", format=".3f"),
                 alt.Tooltip("folds:N", title="Folds en que mejora")])
    texto = alt.Chart(t).mark_text(align="left", dx=10, dy=-9, fontSize=11, color=TEXTO_FUERTE).encode(
        y=y, x=alt.X("f1:Q", scale=x), text=alt.Text("f1:Q", format=".3f"))
    rotulo = alt.Chart(pd.DataFrame({"x": [base_f1 + base_sd], "t": ["un desvío del modelo sin agregar nada"]})).mark_text(
        align="left", baseline="top", dx=4, dy=2, fontSize=11, color=COLOR_ELEGIDO).encode(
        x=alt.X("x:Q", scale=x), y=alt.value(0), text="t:N")
    return alt.layer(banda, linea, rotulo, rango, puntos, texto).properties(width=440, height=380)


def grafico_cortes(cortes):
    """Paso 6: con cada forma de cortar los intervalos, el f1 macro (validación) de la logística balanceada y de
    Poisson, unidos por una línea. Los f1 no se comparan entre filas (con menos intervalos todo sube): lo que importa es
    que en todas el punto de Poisson queda a la derecha."""
    # de menos a más intervalos: se ve que con más intervalos el f1 baja para los dos modelos
    orden_k = sorted(cortes, key=lambda k: (cortes[k]["intervalos"], "(el elegido)" not in k, k))
    nombre = {k: f"{int(cortes[k]['intervalos'])} intervalos:  " + " ".join(f"[{t.strip()}]" for t in k.replace(" (el elegido)", "").split("|"))
              + ("  (los nuestros)" if "(el elegido)" in k else "") for k in orden_k}
    orden = [nombre[k] for k in orden_k]
    filas = []
    for k in orden_k:
        d = cortes[k]
        for modelo, clave in (("logística", "logística (balanced)"), ("Poisson", "Poisson")):
            filas.append({"cortes": nombre[k], "modelo": modelo, "f1": d[clave], "piso": d["piso"]})
    t = pd.DataFrame(filas)
    une = t.pivot(index="cortes", columns="modelo", values="f1").reset_index()
    x = alt.Scale(domain=[0.2, 0.6], nice=False)
    y = alt.Y("cortes:N", sort=orden, title=None, axis=alt.Axis(
        grid=False, domain=False, ticks=False, labelFontSize=13, labelLimit=320, labelPadding=10,
        labelColor={"condition": {"test": "indexof(datum.value, 'nuestros') >= 0", "value": COLOR_ELEGIDO}, "value": TEXTO_FUERTE}))
    linea = alt.Chart(une).mark_rule(strokeWidth=4, color=EJE).encode(
        y=y, x=alt.X("logística:Q", scale=x), x2="Poisson:Q")
    color = alt.Color("modelo:N", scale=alt.Scale(domain=["Poisson", "logística"], range=[COLOR_ELEGIDO, COLOR_DESCARTE]),
                      legend=alt.Legend(title=None, orient="bottom", direction="horizontal", labelFontSize=13))
    puntos = alt.Chart(t).mark_circle(size=220, opacity=1).encode(
        y=y, x=alt.X("f1:Q", scale=x, title="f1 macro en validación", axis=alt.Axis(values=[0.2, 0.3, 0.4, 0.5, 0.6], format=".1f")),
        color=color, tooltip=[alt.Tooltip("cortes:N", title="Cortes"), alt.Tooltip("modelo:N", title="Modelo"),
                              alt.Tooltip("f1:Q", title="f1 macro", format=".3f"),
                              alt.Tooltip("piso:Q", title="f1 del piso con estos cortes", format=".3f")])
    texto = alt.Chart(t).mark_text(fontSize=12, fontWeight=700, dy=-15).encode(
        y=y, x=alt.X("f1:Q", scale=x), text=alt.Text("f1:Q", format=".2f"), color=color)
    return (linea + puntos + texto).properties(width=360, height=50 * len(orden))


def grafico_folds(folds, desde):
    """Validación temporal: con qué tramo entrena y con cuál valida cada fold, y el f1 del modelo elegido en cada uno."""
    filas = []
    for i, f in enumerate(folds, start=1):
        nombre = f"Fold {i}"
        filas.append({"fold": nombre, "parte": "entrena", "inicio": desde, "fin": f["entrena_hasta"], "n": f["filas_entrenamiento"]})
        filas.append({"fold": nombre, "parte": "valida", "inicio": f["valida_desde"], "fin": f["valida_hasta"], "n": f["filas_validacion"]})
    t = pd.DataFrame(filas)
    notas = pd.DataFrame([{"fold": f"Fold {i}", "fin": f["valida_hasta"], "f1": f["f1"]} for i, f in enumerate(folds, start=1)])
    y = alt.Y("fold:N", title=None, axis=alt.Axis(grid=False))
    barras = alt.Chart(t).mark_bar(height=16, cornerRadius=2).encode(
        x=alt.X("inicio:T", title=None, axis=alt.Axis(format="%Y")), x2="fin:T", y=y,
        color=alt.Color("parte:N", scale=alt.Scale(domain=["entrena", "valida"], range=[COLOR_PARTICION["entrenamiento"], COLOR_DATOS]),
                        legend=alt.Legend(title=None, orient="bottom", direction="horizontal")),
        tooltip=[alt.Tooltip("fold:N", title="Fold"), alt.Tooltip("parte:N", title="Parte"),
                 alt.Tooltip("inicio:T", title="Desde", format="%d/%m/%Y"), alt.Tooltip("fin:T", title="Hasta", format="%d/%m/%Y"),
                 alt.Tooltip("n:Q", title="Secuencias", format=",")])
    texto = alt.Chart(notas).mark_text(align="left", dx=8, fontSize=12, color=TEXTO_FUERTE).encode(
        x="fin:T", y=y, text=alt.Text("rotulo:N")).transform_calculate(rotulo="'f1 ' + format(datum.f1, '.3f')")
    return (barras + texto).properties(width=520, height=170)


def grafico_alpha(ajuste_alpha, elegido):
    """f1 macro (media ± desvío) según la regularización alpha, con empuje 0."""
    t = pd.DataFrame([{"alpha": float(a), "f1": v[0], "desvio": v[1]} for a, v in ajuste_alpha.items()])
    t["bajo"], t["alto"] = t["f1"] - t["desvio"], t["f1"] + t["desvio"]
    t["elegido"] = np.isclose(t["alpha"], elegido)
    x = alt.X("alpha:Q", title="alpha (regularización, escala logarítmica)", scale=alt.Scale(type="log"),
              axis=alt.Axis(values=list(t["alpha"]), format="~g"))
    color = alt.condition("datum.elegido", alt.value(COLOR_ELEGIDO), alt.value(COLOR_DESCARTE))
    rango = alt.Chart(t).mark_rule(strokeWidth=2.5).encode(
        x=x, y=alt.Y("bajo:Q", title="f1 macro en validación", scale=alt.Scale(domain=[0.3, 0.5])), y2="alto:Q", color=color)
    punto = alt.Chart(t).mark_point(filled=True, size=90, opacity=1).encode(
        x=x, y="f1:Q", color=color, tooltip=[alt.Tooltip("alpha:Q", title="alpha", format="~g"),
                                            alt.Tooltip("f1:Q", title="f1 macro", format=".3f"),
                                            alt.Tooltip("desvio:Q", title="Desvío", format=".3f")])
    texto = alt.Chart(t).mark_text(dx=14, align="left", fontSize=12, color=TEXTO_FUERTE).encode(
        x=x, y="f1:Q", text=alt.Text("f1:Q", format=".3f"))
    return (rango + punto + texto).properties(width=440, height=200)


def grafico_empuje(trade_off, elegido):
    """Recall de cada clase y f1 macro según el empuje: más empuje, más avisos de réplicas y más falsas alarmas."""
    filas = []
    for e, v in trade_off.items():
        for i, c in enumerate(CLASES):
            filas.append({"empuje": float(e), "medida": f"recall {c}", "clase": c, "valor": v[2 + i]})
    t = pd.DataFrame(filas)
    f1 = pd.DataFrame([{"empuje": float(e), "valor": v[0]} for e, v in trade_off.items()])
    x = alt.X("empuje:Q", title="empuje (más alto = se anima más a decir que hay réplicas)",
              axis=alt.Axis(values=sorted(f1["empuje"]), format=".1f"))
    y = alt.Y("valor:Q", title="En validación", scale=alt.Scale(domain=[0, 1]))
    recall = alt.Chart(t).mark_line(point=True, strokeWidth=2).encode(
        x=x, y=y, color=alt.Color("clase:N", scale=ESCALA_CLASE, legend=alt.Legend(title="Recall de la clase", orient="right")),
        tooltip=[alt.Tooltip("medida:N", title="Medida"), alt.Tooltip("empuje:Q", title="Empuje"),
                 alt.Tooltip("valor:Q", title="Valor", format=".3f")])
    macro = alt.Chart(f1).mark_line(point=alt.OverlayMarkDef(shape="square", size=60, filled=True, color=TEXTO_FUERTE), strokeWidth=3,
                                    color=TEXTO_FUERTE).encode(
        x=x, y=y, tooltip=[alt.Tooltip("empuje:Q", title="Empuje"), alt.Tooltip("valor:Q", title="f1 macro", format=".3f")])
    rotulo = alt.Chart(f1.tail(1)).mark_text(align="left", dx=8, fontSize=12, color=TEXTO_FUERTE).encode(
        x=x, y=y, text=alt.value("f1 macro"))
    marca = alt.Chart(pd.DataFrame({"empuje": [elegido]})).mark_rule(strokeDash=[5, 4], color=COLOR_ELEGIDO).encode(x="empuje:Q")
    return (marca + recall + macro + rotulo).properties(width=440, height=240)


def grafico_reporte(reporte):
    """Precisión, recall y f1 de cada clase en el test."""
    filas = [{"clase": c, "medida": m, "valor": d[k], "casos": d["support"]}
             for c, d in reporte.items() for m, k in (("precisión", "precision"), ("recall", "recall"), ("f1", "f1"))]
    t = pd.DataFrame(filas)
    base = alt.Chart(t).encode(
        y=alt.Y("clase:N", sort=CLASES, title=None, axis=alt.Axis(labelLimit=160)),
        x=alt.X("valor:Q", title=None, scale=alt.Scale(domain=[0, 1]), axis=alt.Axis(values=[0, 0.5, 1], format=".1f")))
    barras = base.mark_bar().encode(
        color=alt.Color("clase:N", scale=ESCALA_CLASE, legend=None),
        tooltip=[alt.Tooltip("clase:N", title="Clase"), alt.Tooltip("medida:N", title="Medida"),
                 alt.Tooltip("valor:Q", title="Valor", format=".3f"), alt.Tooltip("casos:Q", title="Casos en el test", format=",")])
    texto = base.mark_text(align="left", dx=4, fontSize=11, color=TEXTO_FUERTE).encode(text=alt.Text("valor:Q", format=".2f"))
    return (barras + texto).properties(width=150, height=130).facet(
        column=alt.Column("medida:N", sort=["precisión", "recall", "f1"], title=None))


def grafico_confusion(matriz):
    """Matriz de confusión en el test: filas = lo que pasó, columnas = lo que dijo el modelo. La intensidad es la
    proporción de la fila (el recall está en la diagonal) y el número, la cantidad de secuencias."""
    filas = []
    for i, real in enumerate(CLASES):
        total = sum(matriz[i])
        for j, pred in enumerate(CLASES):
            filas.append({"real": real, "pred": pred, "n": matriz[i][j], "proporcion": matriz[i][j] / total if total else 0})
    t = pd.DataFrame(filas)
    base = alt.Chart(t).encode(
        x=alt.X("pred:N", sort=CLASES, title="Lo que dijo el modelo", axis=alt.Axis(labelAngle=0, orient="top", grid=False)),
        y=alt.Y("real:N", sort=CLASES, title="Lo que pasó", axis=alt.Axis(grid=False)))
    celdas = base.mark_rect(color=COLOR_ELEGIDO, stroke=FONDO_GRAFICO, strokeWidth=2).encode(
        opacity=alt.Opacity("proporcion:Q", scale=alt.Scale(domain=[0, 1], range=[0.04, 0.9]), legend=None),
        tooltip=[alt.Tooltip("real:N", title="Pasó"), alt.Tooltip("pred:N", title="Dijo el modelo"),
                 alt.Tooltip("n:Q", title="Secuencias", format=","), alt.Tooltip("proporcion:Q", title="% de la fila", format=".1%")])
    texto = base.mark_text(fontSize=13, fontWeight=600).encode(
        text=alt.Text("n:Q", format=","),
        color=alt.condition("datum.proporcion > 0.5", alt.value(FONDO_GRAFICO), alt.value(TEXTO_FUERTE)))
    return (celdas + texto).properties(width=460, height=200)


def grafico_tramos_test(acierto, n_por_tramo):
    """Qué proporción del test acierta el intervalo, por tramo de magnitud."""
    t = pd.DataFrame([{"tramo": k, "acierto": v / 100, "n": n_por_tramo[k]} for k, v in acierto.items()])
    orden = list(acierto)
    base = alt.Chart(t).encode(
        y=alt.Y("tramo:N", sort=orden, title="Magnitud", axis=alt.Axis(grid=False)),
        x=alt.X("acierto:Q", title="Acierta el intervalo (test)", scale=alt.Scale(domain=[0, 1]), axis=alt.Axis(format="%")))
    barras = base.mark_bar(color=COLOR_ELEGIDO).encode(
        tooltip=[alt.Tooltip("tramo:N", title="Magnitud"), alt.Tooltip("acierto:Q", title="Acierta", format=".1%"),
                 alt.Tooltip("n:Q", title="Secuencias", format=",")])
    texto = base.mark_text(align="left", dx=6, fontSize=12, color=TEXTO_FUERTE).encode(
        text="rotulo:N").transform_calculate(rotulo="format(datum.acierto, '.1%') + '  de ' + format(datum.n, ',')")
    return (barras + texto).properties(width=420, height=150)


def grafico_permutacion(importancia, f1_test, f1_piso):
    """En qué se apoya el modelo: el f1 macro del test con todas sus columnas y desordenando cada una (importancia por
    permutación, media de 20 repeticiones), contra el piso. Si al desordenar una columna el f1 cae al piso, el modelo
    depende de ella."""
    nombres = {"mainshock_mag": "desordenando la magnitud", "mainshock_depth": "desordenando la profundidad",
               "region_mc": "desordenando el umbral de la región"}
    filas = [{"fila": "el modelo, con todo", "f1": f1_test, "baja": 0.0, "desvio": 0.0, "tipo": "modelo"}]
    for c, v in sorted(importancia.items(), key=lambda kv: kv[1]["media"]):
        filas.append({"fila": nombres[c], "f1": f1_test - v["media"], "baja": v["media"], "desvio": v["desvio"], "tipo": "desordenada"})
    t = pd.DataFrame(filas)
    t["rotulo"] = [es(f, 2) if tipo == "modelo" else f"{es(f, 2)}  (baja {es(b, 2)})" for f, b, tipo in zip(t["f1"], t["baja"], t["tipo"])]
    x = alt.Scale(domain=[0, 0.6], nice=False)
    y = alt.Y("fila:N", sort=t["fila"].tolist(), title=None,
              axis=alt.Axis(grid=False, domain=False, ticks=False, labelLimit=280, labelFontSize=13, labelColor=TEXTO_FUERTE))
    barras = alt.Chart(t).mark_bar(height=24, cornerRadiusEnd=3).encode(
        y=y, x=alt.X("f1:Q", scale=x, title="f1 macro en el test", axis=alt.Axis(values=[0, 0.1, 0.2, 0.3, 0.4, 0.5], format=".1f")),
        color=alt.Color("tipo:N", scale=alt.Scale(domain=["modelo", "desordenada"], range=[COLOR_ELEGIDO, COLOR_NEUTRO]), legend=None),
        tooltip=[alt.Tooltip("fila:N", title="Versión"), alt.Tooltip("f1:Q", title="f1 macro en el test", format=".3f"),
                 alt.Tooltip("baja:Q", title="Cuánto baja", format=".3f"),
                 alt.Tooltip("desvio:Q", title="Desvío (20 repeticiones)", format=".3f")])
    texto = alt.Chart(t).mark_text(align="left", dx=8, fontSize=13, fontWeight=700, color=TEXTO_FUERTE).encode(
        y=y, x=alt.X("f1:Q", scale=x), text="rotulo:N")
    piso = pd.DataFrame({"x": [f1_piso], "t": [f"piso: contestar siempre «ninguna» ({es(f1_piso, 2)})"]})
    linea = alt.Chart(piso).mark_rule(strokeDash=[5, 4], color=COLOR_DESCARTE, strokeWidth=2).encode(x=alt.X("x:Q", scale=x))
    rotulo = alt.Chart(piso).mark_text(align="left", baseline="bottom", dx=4, dy=-4, fontSize=12, fontWeight=600,
                                       color=COLOR_DESCARTE).encode(x=alt.X("x:Q", scale=x), y=alt.value(0), text="t:N")
    return (linea + barras + texto + rotulo).properties(width=420, height=170)


# =================================================================== 4. EXPLORÁ (la copa)
OPC_REGION = ["todas"]
OPC_VER = ["solo test (nunca vistas por el modelo)", "todas (incluye entrenamiento)"]
OPC_COLOR = ["clase real", "clase que dijo el modelo"]


def filas_explora(secuencias):
    """Una fila por secuencia con sólo las columnas que usan los gráficos y el globo."""
    s = secuencias["columnas"]
    cl = secuencias["clases"]
    d = pd.DataFrame({"id": s["id"], "lugar": s["lugar"], "region": s["region"], "fecha": s["fecha"],
                      "lat": s["lat"], "lon": s["lon"], "mag": s["mag"], "mag_max": s["mag_max"], "prof": s["prof"],
                      "replicas": s["replicas"], "mu": np.round(s["mu"], 3), "test": s["test"]})
    d["real_i"], d["pred_i"] = s["real"], s["pred"]
    d["real"], d["pred"] = d["real_i"].map(lambda i: cl[i]), d["pred_i"].map(lambda i: cl[i])
    for i, nombre in enumerate(["p_ninguna", "p_pocas", "p_moderadas", "p_muchas"]):
        d[nombre] = [round(p[i], 3) for p in s["probs"]]
    return d.drop(columns=["id"])


def grafico_resultado(datos):
    """Qué dijo el modelo para lo que realmente fue cada clase, con los mismos filtros del globo.
    Los filtros son parámetros con nombre sin control propio: los mueve la página (los controles están en el globo).
         region  -> filtra por región      (transform_filter)
         mag_min -> magnitud mínima        (transform_filter)
         ver     -> sólo test / todas      (transform_filter)
    """
    p_region = alt.param(name="region", value="todas")
    p_mag = alt.param(name="mag_min", value=4.0)
    p_ver = alt.param(name="ver", value=OPC_VER[0])
    filtro = ("(region == 'todas' || datum.region == region) && datum.mag >= mag_min"
              " && (ver == '" + OPC_VER[1] + "' || datum.test == 1)")
    # se cuenta por (real, dijo el modelo) y se divide por el total de la barra para tener el % del tramo
    return (alt.Chart(datos)
            .transform_filter(filtro)
            .transform_aggregate(n="count()", groupby=["real", "pred", "pred_i"])
            .transform_joinaggregate(total="sum(n)", groupby=["real"])
            .transform_calculate(proporcion="datum.n / datum.total")
            .mark_bar()
            .encode(x=alt.X("real:N", sort=CLASES, title="Lo que realmente pasó", axis=alt.Axis(labelAngle=0)),
                    y=alt.Y("n:Q", stack="normalize", title="Lo que dijo el modelo", axis=alt.Axis(format="%")),
                    color=alt.Color("pred:N", scale=ESCALA_CLASE, legend=alt.Legend(title="Dijo el modelo")),
                    order=alt.Order("pred_i:Q", sort="ascending"),
                    tooltip=[alt.Tooltip("real:N", title="Real"), alt.Tooltip("pred:N", title="Dijo el modelo"),
                             alt.Tooltip("n:Q", title="Secuencias"),
                             alt.Tooltip("proporcion:Q", title="% de la barra", format=".1%")])
            .add_params(p_region, p_mag, p_ver)
            .properties(width=640, height=220))


# =================================================================== textos que dependen de números
def textos(df, medidas, comparacion):
    """Títulos, oración central y números de la portada: salen de los valores calculados."""
    from referencia_sklearn import a_intervalo
    total = len(df)
    clase = pd.Series(a_intervalo(df["n_aftershocks"])).value_counts().reindex(CLASES)
    t_h1 = tabla_h1(df)
    mult = pendiente_h1(t_h1)
    alto = t_h1.loc[np.isclose(t_h1["tramo"], CORTE_ALTO), "media"].iloc[0]   # el punto del gráfico en ese tramo
    f_test, f_piso = medidas["final"]["f1_test"], medidas["piso"]["f1_test"]
    avisos = medidas["avisos_test"]
    avisados = avisos["avisados_pct"]
    falsas = avisos["falsas_alarmas"] / (avisos["falsas_alarmas"] + avisos["avisos_correctos"])
    veces = f_test / f_piso
    return {
        "oracion": "El modelo sirve para priorizar qué sismos vigilar, no para emitir alertas.",
        "aclaracion": ("Con la magnitud sobre el umbral de su región y la profundidad, avisa de "
                       f"{round(avisados / 10)} de cada 10 secuencias que tuvieron réplicas, pero "
                       f"{round(falsas * 4)} de cada 4 avisos son falsas alarmas."),
        "pregunta": "Cuando ocurre un sismo, ¿cuántas réplicas podemos esperar?",
        "numeros": [
            {"valor": f"{es(f_test, 2)} contra {es(f_piso, 2)}", "texto": "f1 macro del modelo contra el piso, en sismos que no vio al entrenar (test)"},
            {"valor": f"{es(avisados, 1)} %", "texto": "de las secuencias que tuvieron réplicas fueron avisadas por el modelo"},
            {"valor": f"× {es(medidas['coeficientes']['multiplicador_por_punto'], 1)}",
             "texto": "réplicas esperadas por cada punto de magnitud sobre el umbral de la región"}],
        "titulo_datos": (f"El {es(clase.iloc[0] / total * 100)} % de las secuencias no deja ninguna réplica, "
                         f"y sólo {es(clase.iloc[3])} de {es(total)} dejan más de diez"),
        "titulo_hallazgo": "Las réplicas no crecen de a poco con la magnitud: se multiplican",
        # los números que sostienen el título van en el texto de debajo del gráfico
        "hallazgo_desde": float(t_h1["media"].iloc[0]), "hallazgo_hasta": float(alto),
        "hallazgo_tramo_alto": f"{es(CORTE_ALTO, 1)} a {es(CORTE_ALTO + 0.5, 1)}",
        "titulo_modelo": (f"El modelo {'más que duplica' if veces >= 2 else 'supera'} al piso: f1 de {es(f_test, 2)} "
                          f"contra {es(f_piso, 2)} en sismos que no vio"),
        "multiplicador_h1": mult,
        # opciones de los controles de Explorá (están en el globo y mueven también las barras de Altair)
        "opciones": {"region_inicial": "todas", "mag_min_inicial": 4.0, "ver": OPC_VER, "color": OPC_COLOR},
    }


# =================================================================== exportación
def a_spec(chart):
    return estilo(chart).to_dict()


def guardar_spec(nombre, chart, carpeta):
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_text(json.dumps(a_spec(chart), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                                  encoding="utf8")
