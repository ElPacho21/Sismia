"""Gráficos de Sisimia, todos con Altair.

Cada función devuelve un gráfico; exportar_specs() los guarda como especificaciones
Vega-Lite (JSON) en app/public/specs/ y la página los dibuja con vega-embed.
La tabla componente por componente de cada uno está en docs/GRAFICOS.md.

Regla de color (una sola paleta, en palette.py):
  * el color SIEMPRE es la clase de réplicas (ninguna / pocas / moderadas / muchas);
  * lo que no es una clase (modelos, regiones, partición) va en grises o con otro canal.
"""
import json
from pathlib import Path

import altair as alt
import numpy as np
import pandas as pd

from palette import CLASES, COLOR_CLASE, COLOR_DATOS, COLOR_ELEGIDO, COLOR_NEUTRO

alt.data_transformers.disable_max_rows()

# la misma escala de color en todos los gráficos
ESCALA_CLASE = alt.Scale(domain=CLASES, range=COLOR_CLASE)
CORTE_ALTO = 2.5            # tramo (+2,5 a +3,0 sobre el umbral) que el título de H1 cita; se lee directo en el gráfico
FUENTE = "system-ui, -apple-system, 'Segoe UI', sans-serif"


def es(valor, decimales=0):
    """Número con formato español: 21.292 y 0,50."""
    texto = f"{valor:,.{decimales}f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def estilo(chart):
    return (chart.configure(font=FUENTE).configure_axis(labelFontSize=12, titleFontSize=12, grid=True,
                                                         gridColor="#ece9e1", domainColor="#8a877f")
            .configure_view(stroke=None).configure_legend(labelFontSize=12, titleFontSize=12))


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
        text=alt.Text("etiqueta:N"), color=alt.value("#222")).transform_calculate(
        etiqueta="format(datum.secuencias, ',') + '  (' + format(datum.porcentaje, '.1f') + ' %)'")
    return (barras + texto).properties(width=560, height=170)


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


def pendiente_h1(t):
    """Cuánto se multiplican las réplicas medias por punto de magnitud (ajuste exponencial de los tramos)."""
    return float(np.exp(np.polyfit(t["centro"], np.log(t["media"]), 1)[0]))


def grafico_hallazgo(df):
    t = tabla_h1(df)
    base = alt.Chart(t).encode(
        x=alt.X("centro:Q", title="Magnitud del sismo principal sobre el umbral de su región (puntos)",
                scale=alt.Scale(zero=False, nice=False), axis=alt.Axis(values=list(np.arange(0, 5.1, 0.5)), format=".1f")),
        y=alt.Y("media:Q", title="Réplicas medias por secuencia (escala logarítmica)",
                scale=alt.Scale(type="log", domain=[0.1, 1000]), axis=alt.Axis(format="~g")))
    # recta de crecimiento constante: se ajusta una recta a log(media) y se vuelve a la escala original
    recta = (base.transform_calculate(ln="log(datum.media)")
             .transform_regression("centro", "ln")
             .transform_calculate(media="exp(datum.ln)")
             .mark_line(color=COLOR_NEUTRO, strokeDash=[6, 4], strokeWidth=2))
    puntos = base.mark_circle(color=COLOR_DATOS, opacity=0.9).encode(
        size=alt.Size("secuencias:Q", scale=alt.Scale(type="sqrt", range=[40, 900]),
                      legend=alt.Legend(title="Secuencias en el tramo", values=[10, 100, 1000, 10000])),
        tooltip=[alt.Tooltip("rotulo:N", title="Magnitud sobre el umbral"),
                 alt.Tooltip("secuencias:Q", title="Secuencias", format=","),
                 alt.Tooltip("media:Q", title="Réplicas medias", format=".2f")])
    return (recta + puntos).properties(width=560, height=330)


# =================================================================== 3. EL MODELO
def grafico_modelo(comparacion):
    """f1 macro de validación (media ± desvío) de cada modelo, con el piso marcado."""
    t = pd.DataFrame([{"modelo": k, "f1": v[0], "desvio": v[1]} for k, v in comparacion.items()])
    t["bajo"], t["alto"] = t["f1"] - t["desvio"], t["f1"] + t["desvio"]
    t["elegido"] = t["modelo"].str.startswith("Poisson elegido")
    piso = float(t.loc[t["modelo"].str.startswith("piso"), "f1"].iloc[0])
    orden = t.sort_values("f1", ascending=False)["modelo"].tolist()
    base = alt.Chart(t).encode(
        y=alt.Y("modelo:N", sort=orden, title=None, axis=alt.Axis(labelLimit=300)),
        color=alt.condition("datum.elegido", alt.value(COLOR_ELEGIDO), alt.value(COLOR_NEUTRO)))
    rango = base.mark_rule(strokeWidth=3).encode(
        x=alt.X("bajo:Q", title="f1 macro en validación temporal (media ± desvío, 5 folds)",
                scale=alt.Scale(domain=[0, 0.6], zero=True)), x2="alto:Q")
    punto = base.mark_point(filled=True, size=90, opacity=1).encode(
        x="f1:Q", tooltip=[alt.Tooltip("modelo:N", title="Modelo"), alt.Tooltip("f1:Q", title="f1 macro", format=".3f"),
                           alt.Tooltip("desvio:Q", title="Desvío", format=".3f")])
    etiqueta = base.mark_text(align="left", dx=10, fontSize=11).encode(
        x="alto:Q", text=alt.Text("f1:Q", format=".2f"), color=alt.value("#444"))
    linea_piso = alt.Chart(pd.DataFrame({"piso": [piso]})).mark_rule(
        strokeDash=[5, 4], color="#222", strokeWidth=1.5).encode(x="piso:Q")
    return (linea_piso + rango + punto + etiqueta).properties(width=520, height=330)


# =================================================================== 4. EXPLORÁ (la copa)
OPC_REGION = ["todas"]
OPC_VER = ["solo test (nunca vistas por el modelo)", "todas (incluye entrenamiento)"]
OPC_COLOR = ["clase real", "clase que dijo el modelo"]


def filas_explora(secuencias):
    """Una fila por secuencia con sólo las columnas que usan los gráficos."""
    s = secuencias["columnas"]
    cl = secuencias["clases"]
    d = pd.DataFrame({"id": s["id"], "lugar": s["lugar"], "region": s["region"], "fecha": s["fecha"],
                      "lat": s["lat"], "lon": s["lon"], "mag": s["mag"], "prof": s["prof"],
                      "replicas": s["replicas"], "mu": np.round(s["mu"], 3), "test": s["test"]})
    d["real_i"], d["pred_i"] = s["real"], s["pred"]
    d["real"], d["pred"] = d["real_i"].map(lambda i: cl[i]), d["pred_i"].map(lambda i: cl[i])
    for i, nombre in enumerate(["p_ninguna", "p_pocas", "p_moderadas", "p_muchas"]):
        d[nombre] = [round(p[i], 3) for p in s["probs"]]
    return d.drop(columns=["id"])


def grafico_explora(datos, regiones, nombres_region):
    """Panorama + detalle a pedido + resultado del modelo. Los controles son parámetros con nombre:
         region    -> filtra por región           (transform_filter de todas las capas)
         mag_min   -> magnitud mínima             (transform_filter)
         ver       -> sólo test / todas           (transform_filter)
         color_por -> qué clase pinta el punto    (transform_calculate -> canal color)
         zona      -> rectángulo dibujado en el mapa (selección de intervalo): filtra las barras
    """
    p_region = alt.param(name="region", value="todas", bind=alt.binding_select(
        options=OPC_REGION + nombres_region, name="Región: "))
    p_mag = alt.param(name="mag_min", value=4.0, bind=alt.binding_range(min=4.0, max=8.0, step=0.1,
                                                                        name="Magnitud mínima: "))
    p_ver = alt.param(name="ver", value=OPC_VER[0], bind=alt.binding_select(options=OPC_VER, name="Secuencias: "))
    p_color = alt.param(name="color_por", value=OPC_COLOR[0], bind=alt.binding_select(
        options=OPC_COLOR, name="Pintar según: "))
    zona = alt.selection_interval(name="zona", encodings=["x", "y"])

    filtro = ("(region == 'todas' || datum.region == region) && datum.mag >= mag_min"
              " && (ver == '" + OPC_VER[1] + "' || datum.test == 1)")

    cajas = alt.Chart(regiones).mark_rect(fill=None, stroke="#9c998f", strokeDash=[4, 3], strokeWidth=1.2).encode(
        x="oeste:Q", x2="este:Q", y="sur:Q", y2="norte:Q")
    nombres = alt.Chart(regiones).mark_text(align="left", baseline="top", dx=4, dy=3, fontSize=11, color="#6b6860").encode(
        x="oeste:Q", y="norte:Q", text="nombre:N")

    mapa = (alt.Chart(datos)
            .transform_filter(filtro)
            .transform_calculate(clase_mostrada="color_por == '" + OPC_COLOR[0] + "' ? datum.real : datum.pred",
                                 orden="color_por == '" + OPC_COLOR[0] + "' ? datum.real_i : datum.pred_i",
                                 particion="datum.test == 1 ? 'test' : 'entrenamiento'")
            .mark_circle(stroke="white", strokeWidth=0.3)
            .encode(x=alt.X("lon:Q", title="Longitud", scale=alt.Scale(zero=False, domain=[-112, 150])),
                    y=alt.Y("lat:Q", title="Latitud", scale=alt.Scale(zero=False, domain=[-57, 48])),
                    size=alt.Size("mag:Q", scale=alt.Scale(type="sqrt", domain=[4, 9], range=[10, 320]),
                                  legend=alt.Legend(title="Magnitud")),
                    color=alt.Color("clase_mostrada:N", scale=ESCALA_CLASE, legend=alt.Legend(title="Réplicas")),
                    order=alt.Order("orden:Q", sort="ascending"),
                    opacity=alt.condition(zona, alt.value(0.75), alt.value(0.12)),
                    tooltip=[alt.Tooltip("lugar:N", title="Lugar"), alt.Tooltip("fecha:T", title="Fecha", format="%d/%m/%Y"),
                             alt.Tooltip("mag:Q", title="Magnitud"), alt.Tooltip("prof:Q", title="Profundidad (km)"),
                             alt.Tooltip("replicas:Q", title="Réplicas reales"), alt.Tooltip("real:N", title="Clase real"),
                             alt.Tooltip("pred:N", title="Dijo el modelo"), alt.Tooltip("mu:Q", title="Réplicas esperadas", format=".2f"),
                             alt.Tooltip("p_ninguna:Q", title="P(ninguna)", format=".0%"),
                             alt.Tooltip("p_pocas:Q", title="P(pocas)", format=".0%"),
                             alt.Tooltip("p_moderadas:Q", title="P(moderadas)", format=".0%"),
                             alt.Tooltip("p_muchas:Q", title="P(muchas)", format=".0%"),
                             alt.Tooltip("particion:N", title="Partición")])
            .add_params(zona))
    panorama = alt.layer(cajas, nombres, mapa).properties(width=680, height=380)

    # qué dijo el modelo para lo que realmente fue cada clase (se mueve con todos los controles y con la zona dibujada)
    resultado = (alt.Chart(datos)
                 .transform_filter(filtro).transform_filter(zona)
                 .mark_bar()
                 .encode(x=alt.X("real:N", sort=CLASES, title="Lo que realmente pasó", axis=alt.Axis(labelAngle=0)),
                         y=alt.Y("count():Q", stack="normalize", title="Lo que dijo el modelo",
                                 axis=alt.Axis(format="%")),
                         color=alt.Color("pred:N", scale=ESCALA_CLASE, legend=None),
                         order=alt.Order("pred_i:Q", sort="ascending"),
                         tooltip=[alt.Tooltip("real:N", title="Real"), alt.Tooltip("pred:N", title="Dijo el modelo"),
                                  alt.Tooltip("count():Q", title="Secuencias")])
                 .properties(width=680, height=170))

    # la escala de color de las barras es independiente (la leyenda ya está en el mapa); es la misma escala de clases
    return alt.vconcat(panorama, resultado, spacing=22).resolve_scale(color="independent").add_params(
        p_region, p_mag, p_ver, p_color)


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
    avisados = medidas["avisos_test"]["avisados_pct"]
    veces = f_test / f_piso
    return {
        "oracion": ("Con la magnitud sobre el umbral de su región y la profundidad, el modelo sirve para priorizar "
                    f"qué sismos vigilar, no para emitir alertas: avisa de {round(avisados / 10)} de cada 10 "
                    "secuencias con réplicas."),
        "pregunta": "Cuando ocurre un sismo, ¿cuántas réplicas podemos esperar?",
        "numeros": [
            {"valor": f"{es(f_test, 2)} contra {es(f_piso, 2)}", "texto": "f1 macro del modelo contra el piso, en sismos que no vio al entrenar (test)"},
            {"valor": f"{es(avisados, 1)} %", "texto": "de las secuencias que tuvieron réplicas fueron avisadas por el modelo"},
            {"valor": f"× {es(medidas['coeficientes']['multiplicador_por_punto'], 1)}",
             "texto": "réplicas esperadas por cada punto de magnitud sobre el umbral de la región"}],
        "titulo_datos": (f"El {es(clase.iloc[0] / total * 100)} % de las secuencias no deja ninguna réplica, "
                         f"y sólo {es(clase.iloc[3])} de {es(total)} dejan más de diez"),
        "titulo_hallazgo": (f"Las réplicas crecen con la magnitud: de {es(t_h1['media'].iloc[0], 1)} de media en los "
                            f"sismos que apenas superan el umbral a {es(alto)} en los que lo superan "
                            f"por {es(CORTE_ALTO, 1)} a {es(CORTE_ALTO + 0.5, 1)} puntos"),
        "titulo_modelo": (f"El modelo {'más que duplica' if veces >= 2 else 'supera'} al piso: f1 de {es(f_test, 2)} "
                          f"contra {es(f_piso, 2)} en sismos que no vio"),
        "multiplicador_h1": mult,
        # opciones de los controles de Explorá: una sola fuente para el gráfico y para el globo
        "opciones": {"region_inicial": "todas", "mag_min_inicial": 4.0, "ver": OPC_VER, "color": OPC_COLOR},
    }


# =================================================================== exportación
def a_spec(chart):
    return estilo(chart).to_dict()


def guardar_spec(nombre, chart, carpeta):
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_text(json.dumps(a_spec(chart), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                                  encoding="utf8")
