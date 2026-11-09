"""Paleta única de la app. La usan los gráficos de Altair y el globo (vía palette.json).
Los colores de las clases son los mismos que ya usaba el notebook de la Entrega 3."""
CLASES = ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"]
COLOR_CLASE = ["#7a7974", "#2a78d6", "#d6762a", "#1f9e6b"]
# partición de los datos: misma codificación en todos los gráficos
COLOR_PARTICION = {"entrenamiento": "#b9b6ae", "test": "#1a1a1a"}
# fuera de las clases: el modelo elegido destaca; lo demás, en grises
COLOR_ELEGIDO = "#0b7285"
COLOR_NEUTRO = "#8a877f"
COLOR_DATOS = "#3d3b36"
