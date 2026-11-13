"""Paleta única de la app. La usan los gráficos de Altair y el globo (vía palette.json).
Los colores de las clases son los mismos que ya usaba el notebook de la Entrega 3 y no cambian con el tema.
El tema es oscuro («sala de registro sísmico»): los neutros de los gráficos viven acá, no en el CSS."""
CLASES = ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"]
COLOR_CLASE = ["#7a7974", "#2a78d6", "#d6762a", "#1f9e6b"]
# partición de los datos: misma codificación en todos los gráficos
COLOR_PARTICION = {"entrenamiento": "#5d6d8a", "test": "#e8edf5"}
# fuera de las clases: el modelo elegido destaca (sigue siendo el azul verdoso del texto); lo demás, en grises fríos
COLOR_ELEGIDO = "#3bb3c8"
COLOR_NEUTRO = "#8593ab"
COLOR_DATOS = "#dbe3f0"

# neutros de los gráficos sobre el fondo oscuro (la «placa» donde se apoya cada gráfico)
FONDO_GRAFICO = "#111a2b"
TEXTO_GRAFICO = "#b7c3d6"
TEXTO_FUERTE = "#e8edf5"
GRILLA = "#202e47"
EJE = "#566890"
TRAZO_CAJAS = "#6f82a3"
COLOR_COSTA = "#8aa0c4"      # costas del mapa de fondo de Explorá: finas y tenues
