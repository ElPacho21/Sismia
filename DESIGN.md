---
name: Sisimia
description: Explorador público de un modelo de réplicas sísmicas (USGS, 5 regiones de subducción), con gráficos Altair, prueba del modelo y globo 3D. Design system «Sisimia Estratos», tema basalto (oscuro).
colors:
  suelo: "#16110d"
  estrato: "#211912"
  estrato-alto: "#2b2119"
  placa: "#211912"
  veta: "#45362a"
  veta-fuerte: "#7d6853"
  tinta: "#f0e4d3"
  tinta-suave: "#c6b39d"
  arcilla: "#e2946a"
  aviso: "#e0aa55"
  error: "#f08a7a"
  clase-ninguna: "#6b6662"
  clase-pocas: "#2483c6"
  clase-moderadas: "#ce8730"
  clase-muchas: "#c2a6fb"
  elegido: "#7cc0bd"
  descarte: "#c66f76"
  sismo-principal: "#7cff4f"
  sismo-mayor: "#ffffff"
  globo-espacio: "#0d0a08"
typography:
  display:
    fontFamily: "Alegreya Variable, Georgia, serif"
    fontSize: "clamp(2.2rem, 5vw, 3.7rem)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Alegreya Variable, Georgia, serif"
    fontSize: "clamp(1.6rem, 2.8vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Alegreya Variable, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  control: "3px"
  placa: "4px"
  globo: "10px"
  pill: "999px"
spacing:
  seccion: "4.5rem"
  copa: "5.5rem"
  columna-tallo: "250px"
components:
  placa-grafico:
    backgroundColor: "{colors.placa}"
    rounded: "{rounded.placa}"
    padding: "1.2rem"
  campo:
    backgroundColor: "{colors.estrato-alto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.7rem"
  chip-ejemplo:
    backgroundColor: "{colors.estrato-alto}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.8rem"
  globo-caja:
    backgroundColor: "{colors.globo-espacio}"
    rounded: "{rounded.globo}"
---

# Design System: Sisimia

> **Fuente del diseño:** el design system **Sisimia Estratos** (https://claude.ai/artifact/DzL7JqPRcjypCqAeGwCym4) tiene los tokens, las reglas de uso y los componentes de referencia. Este archivo resume cómo los aplica la app. Ante una duda de diseño (un color, una tipografía, un componente nuevo, una regla), consultá primero el design system; si la app se aparta de él, anotá acá por qué. La app arranca en basalto (oscuro), aunque el design system pone loess (claro) primero.

## Overview

**Creative North Star: «Estratos»** (design system *Sisimia Estratos*, tema **basalto**)

La página se lee como un corte de terreno: marrones de tierra, placas planas separadas por vetas de 1px y un único acento, la arcilla. La interfaz es monocroma; **el color vivo es dato**: sólo las cuatro clases de réplicas, el modelo elegido y lo descartado llevan croma. El design system define dos temas, **basalto** (oscuro, por defecto) y **loess** (claro); se eligen con el botón de ícono del testigo (sol en el tema oscuro, luna en el claro: muestra adónde se pasa; es el único ícono de la interfaz), que se recuerda en el navegador (`localStorage`, clave `sisimia-tema`; `index.html` lo aplica antes de dibujar para que no parpadee). El globo es el espacio: queda oscuro en los dos.

Dos firmas decorativas, sin datos: una traza de sismograma que se dibuja una vez en la portada, y **la grieta de fondo**, una grieta gruesa que atraviesa el relato desde arriba de la página y se cierra en punta en el borde de la copa (el relato sigue la grieta; donde termina, empieza la parte para explorar). Sin sombras, sin degradados decorativos, sin tarjetas idénticas.

**Key Characteristics:**
- Dos temas: basalto por defecto y loess con `data-theme="loess"` en `<html>`; sólo cambian los colores.
- Un acento de interfaz (arcilla); el resto del croma son los datos, definidos en Python.
- Plano: bordes de 1px, sin sombras, radios chicos «de piedra cortada».
- Tallo (1, 2, 3): título a la izquierda y gráfico a la derecha. Copa (Explorá, Globo, Probá): ancho completo.
- Movimiento sólo al responder una acción, más un único momento orquestado (la traza).

## Colors

Los tokens viven en `:root` de `app/src/estilos.css` con los nombres del design system. Los nombres anteriores (`--hielo`, `--placa-alta`, `--trazo`, `--texto`…) quedan como alias hasta renombrar las reglas.

### Acento
- **Arcilla** (#e2946a): foco, enlaces, resumen de «Cómo lo sabemos», marcadores de sección, deslizadores, el marcador del testigo y la capa de la sección actual. Nunca como relleno de botones o bloques: los resaltes son tonales (`estrato-alto`).

### Neutros
- **Suelo** (#16110d): fondo de página. **Estrato** (#211912) y **Estrato alto** (#2b2119): paneles, campos, chips. **Placa** (#211912): fondo de los gráficos. **Veta** (#45362a) y **Veta fuerte** (#7d6853, ≥3:1): filetes y bordes de controles.
- **Tinta** (#f0e4d3) y **Tinta suave** (#c6b39d): ≥11:1 y ≥5,8:1 sobre suelo, estrato y estrato alto.

### Estado
- **Aviso** (#e0aa55) y **error** (#f08a7a), en borde y texto sobre `estrato-alto`, nunca como relleno sólido.

### Datos (fuente: palette.py, no se redefinen en CSS)
- Clases, cuatro tonos distintos: gris piedra #6b6662 (ninguna) → celeste #2483c6 (pocas) → naranja #ce8730 (moderadas) → lila #c2a6fb (muchas). Se reconocen por el tono y, además, la luminosidad sube con la clase (en loess baja: #888279 → #036ba7 → #803b18 → #46127c), así que el orden se lee también en gris. ΔE ≥ 13 entre clases con cualquier daltonismo.
- **Elegido** (#7cc0bd): lo adoptado / el modelo elegido; el texto lo nombra «verde liquen». **Descarte** (#c66f76): lo que se probó y se dejó; el texto lo nombra «rosa».
- Globo: **sismo principal** verde lima #7cff4f y **sismo mayor** blanco, lejos de los cuatro colores de las clases.
- Tema claro en los gráficos: los specs se generan en basalto y `Grafico.jsx` cambia cada color por su par de `TEMA_CLARO` (palette.py → `paleta.json`), validado con daltonismo igual que basalto. El semáforo y los colores del globo no cambian.
- Neutros de gráficos (`FONDO_GRAFICO`, `TEXTO_GRAFICO`, `GRILLA`, `EJE`, `OCEANO`, `TIERRA`) también en palette.py, con los valores de placa, tinta-suave, veta, veta-fuerte, suelo y horizonte-1.

### Named Rules
**The Color-Is-Data Rule.** Fuera de los gráficos y el globo, el croma es la arcilla y nada más. Un color vivo en la interfaz tiene que significar un dato.
**The Lightness Rule (daltonismo).** Dos colores que comparten un gráfico se distinguen por luminosidad, no sólo por tono. Cada par se valida simulando protanopía, deuteranopía y tritanopía (Machado 2009, ΔE OKLab): entre las clases ≥ 9, elegido/descarte ≥ 12, principal y mayor contra las clases ≥ 11. Además del color va la forma (lleno/hueco, círculo/cuadrado/rombo) o un rótulo directo. El semáforo rojo/amarillo/verde de la Entrega 2 no pasa: lleva la zona escrita en cada celda.
**The Palette-in-Python Rule.** Cambiar un color de datos se hace en `palette.py` y se regenera con `build_app.py`.

## Typography

**Relato (títulos, texto, cifras):** Alegreya (variable 400–900 con itálica, Huerta Tipográfica). **Instrumento (etiquetas de sección, número de paso, etiqueta «Problema», celdas numéricas, valores de las barras, ejes cuantitativos de los gráficos):** IBM Plex Mono 400/500. Ambas self-hosted (`@fontsource-variable/alegreya`, `@fontsource/ibm-plex-mono`), sin CDN.

### Hierarchy
- **Display** (800, 2.2–3.7rem, 1.06, -0.01em): la pregunta de la portada y cifras grandes.
- **Headline** (700, 1.6–2.125rem, 1.12, -0.005em): h2; en el tallo, 1.45–1.8rem y sticky.
- **Body** (400, 19px, 1.55; 17px en móvil): Alegreya tiene ojo chico.
- **Label** (Plex Mono 500, 13px, 0.02em, en minúscula de oración): etiqueta de sección con marcador (punto lleno en el tallo, anillo en la copa).
- **Cifras**: Alegreya trae números de estilo antiguo; en cifras, tablas, barras y el reloj del globo se fuerza `lining-nums tabular-nums`.

### Named Rules
**The Sentence-Case Rule.** Nada en mayúsculas espaciadas; el marcador (punto/anillo) es lo que codifica el tipo de sección.

## Layout

Columna de 1180px. Portada a ancho completo con la franja de tres cifras. El tallo es una grilla de 250px + resto (gap 2,2rem) bajo 960px pasa a bloque. La copa va a ancho completo, con filete superior y un tramo de acento de 56px. La navegación es el testigo: en pantallas de más de 960px, una columna fija de 64px a la izquierda (el cuerpo le deja ese ancho; `scroll-padding-top` de 24px); hasta 960px, una cabecera sticky de 61px arriba (`scroll-padding-top` de 72px). En móvil: padding reducido, globo de 520px, cifras apiladas.

## Elevation & Depth

Plano. La profundidad es tonal: Suelo → Estrato → Estrato alto, separadas por filetes de 1px. Excepción funcional: paneles translúcidos sobre el globo. Nada se eleva en hover; los estados cambian borde o fondo.

## Shapes

Radios chicos, como piedra cortada: 3px controles, 4px placas, 10px globo, píldora sólo en chips de ejemplo. Borde 1px; los avisos y los «Problema» llevan borde completo en `aviso` (no barra lateral).

## Components

- **Placa de gráfico:** Placa con filete; scroll horizontal con desvanecido en el borde si el gráfico es más ancho; barrido de carga mientras se dibuja.
- **«Cómo lo sabemos»:** `details` cerrado por defecto; chevron que rota y apertura animada de altura.
- **Campos y chips:** fondo Estrato alto; foco arcilla de 2px; el chip elegido (`aria-pressed`) toma la arcilla en borde y texto; campo inválido con borde `error`.
- **Respuesta del modelo:** veredicto de 2,1rem con borde del color de la clase; barras que animan su ancho, con marcas de escala; alto mínimo para que el panel no salte.
- **Grieta de fondo:** SVG detrás de todo el contenido (`z-index: -1`; por eso `body` no tiene fondo propio y lo pinta `html`). Una principal de hasta 34px que serpentea por el ancho, más ocho secundarias en diagonal, con bordes ásperos; termina 40px antes de Explorá. Relleno `grieta-hueco`, apenas distinto del suelo, con un labio `grieta-labio` 2,5px debajo; el texto que la cruza conserva su contraste en los dos temas y las placas quedan encima. Forma con semilla (la misma en cada visita), recalculada cuando cambia el alto de la página o el ancho de la ventana; en pantallas angostas se afina. Componente `GrietaFondo.jsx`; el testigo la repite en miniatura sobre las capas del tallo.
- **Testigo (navegación):** un testigo de perforación. Cada sección del relato es una capa con su color de horizonte (`horizonte-1` a `horizonte-4`) y un alto proporcional a lo que mide en la página; Explorá y Probá son capas huecas, tras el borde de la copa. Un marcador de arcilla baja por las capas con la lectura, y al cambiar de sección su rótulo aparece un momento. Con el mouse o el foco se despliega el corte con el título de cada sección; Escape lo cierra. «Sisimia» va en vertical arriba y el botón de tema abajo. Hasta 960px se acuesta: una franja de capas de 8px con el marcador, la sección actual como botón que abre la lista, y el tema. Componente `Testigo.jsx`.
- **Globo:** caja `globo-espacio` con paneles translúcidos; en pantallas táctiles un dedo desplaza la página y dos giran.
- **Movimiento:** `prefers-reduced-motion` desactiva todo; las transiciones usan propiedades explícitas.

## Do's and Don'ts

### Do:
- **Do** mantener los textos, el orden de las secciones y «Cómo lo sabemos» cerrado.
- **Do** dar 44px a los controles en pantallas táctiles.
- **Do** regenerar con `build_app.py` tras tocar `palette.py` o `graficos.py`.

### Don't:
- **Don't** usar color vivo en la interfaz fuera de los datos.
- **Don't** agregar sombras, degradados decorativos ni fundidos de entrada en cada sección.
- **Don't** cargar fuentes ni recursos desde un CDN.
- **Don't** usar etiquetas en mayúsculas espaciadas ni tarjetas idénticas para todo.
