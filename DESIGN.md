---
name: Sisimia
description: Explorador público de un modelo de réplicas sísmicas (USGS, 5 regiones de subducción), con gráficos Altair, prueba del modelo y globo 3D, en una «sala de registro sísmico» oscura.
colors:
  noche: "#070b12"
  placa: "#111a2b"
  placa-alta: "#182338"
  trazo: "#2a3b5c"
  trazo-fuerte: "#3a4f78"
  texto: "#e8edf5"
  texto-suave: "#b7c3d6"
  hielo: "#7fd0e0"
  aviso-ambar: "#e0a04a"
  error-coral: "#ff8f85"
  clase-ninguna: "#7a7974"
  clase-pocas: "#2a78d6"
  clase-moderadas: "#d6762a"
  clase-muchas: "#1f9e6b"
  modelo-elegido: "#3bb3c8"
  globo-espacio: "#04070d"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 4vw, 3.15rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.05rem)"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Instrument Sans Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "Instrument Sans Variable, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 550
rounded:
  control: "5px"
  placa: "9px"
  globo: "14px"
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
    backgroundColor: "{colors.placa-alta}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.7rem"
  chip-ejemplo:
    backgroundColor: "{colors.placa-alta}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.8rem"
  globo-caja:
    backgroundColor: "{colors.globo-espacio}"
    rounded: "{rounded.globo}"
---

# Design System: Sisimia

## Overview

**Creative North Star: "La sala de registro sísmico"**

Una página de lectura nocturna, como el cuarto de un observatorio: fondo azul-noche, placas de instrumento con filete fino y un único acento frío. La interfaz es casi monocromática; **el color es dato**: sólo las cuatro clases de réplicas (y el modelo elegido) llevan croma. El globo ya era oscuro, así que ahora la página y el globo son la misma noche.

La única firma decorativa es una traza de sismograma que se dibuja una vez en la portada (ornamental, sin datos). Todo lo demás es disciplinado: sin sombras, sin degradados decorativos, sin tarjetas idénticas.

**Key Characteristics:**
- Tema oscuro único (`color-scheme: dark`).
- Un acento de interfaz (hielo); el resto del croma son las clases, definidas en Python.
- Plano: bordes de 1px, sin sombras.
- Tallo (1, 2, 3): título a la izquierda y gráfico a la derecha. Copa (Explorá, Globo, Probá): ancho completo.
- Movimiento sólo al responder una acción, más un único momento orquestado (la traza).

## Colors

### Primary
- **Hielo** (#7fd0e0): foco, enlaces, resumen de «Cómo lo sabemos», marcadores de sección, deslizadores, estado activo de la barra.

### Neutral
- **Noche** (#070b12): fondo de página. **Placa** (#111a2b) y **Placa alta** (#182338): gráficos, paneles, campos. **Trazo** (#2a3b5c) y **Trazo fuerte** (#3a4f78): filetes y bordes.
- **Texto** (#e8edf5) y **Texto suave** (#b7c3d6): contraste mínimo 8:1 sobre Noche.

### Estado
- **Ámbar** (#e0a04a) en avisos y **coral** (#ff8f85) en errores.

### Datos (fuente: palette.py, no se redefinen en CSS)
- Clases: gris #7a7974 (ninguna), azul #2a78d6 (pocas), naranja #d6762a (moderadas), verde #1f9e6b (muchas).
- **Modelo elegido** (#3bb3c8): azul verdoso (el texto lo nombra así).
- Neutros de gráficos (`FONDO_GRAFICO`, `TEXTO_GRAFICO`, `GRILLA`, `EJE`) también en palette.py, alineados con Placa.

### Named Rules
**The Color-Is-Data Rule.** Fuera de los gráficos y el globo, el croma es el hielo y nada más. Un color vivo en la interfaz tiene que significar una clase.
**The Palette-in-Python Rule.** Cambiar un color de datos se hace en `palette.py` y se regenera con `build_app.py`.

## Typography

**Títulos y cifras:** Schibsted Grotesk Variable. **Texto, formularios, tablas y ejes:** Instrument Sans Variable. Ambas self-hosted (`@fontsource-variable`), sin CDN.

### Hierarchy
- **Display** (700, 1.9–3.15rem, 1.1, -0.025em): h1 de la portada y cifras grandes.
- **Headline** (650, 1.5–2.05rem, 1.18): h2; en el tallo, 1.45–1.8rem y sticky.
- **Body** (400, 17px, 1.62): «qué mirar» hasta 44em.
- **Label** (550, 0.92rem, en minúscula): etiqueta de sección con marcador (punto lleno en el tallo, anillo en la copa).
- **Cifras** con `tabular-nums` en tablas, barras y números de la portada.

### Named Rules
**The Sentence-Case Rule.** Las etiquetas no van en mayúsculas espaciadas; el marcador (punto/anillo) es lo que codifica el tipo de sección.

## Layout

Columna de 1180px. Portada a ancho completo con la franja de tres cifras. El tallo es una grilla de 250px + resto (gap 2,2rem) bajo 960px pasa a bloque. La copa va a ancho completo, con filete superior y un tramo de acento de 56px. Barra sticky de 56px; `scroll-padding-top` de 72px. En móvil: padding reducido, globo de 520px, cifras apiladas.

## Elevation & Depth

Plano. La profundidad es tonal: Noche → Placa → Placa alta, separadas por filetes de 1px. Excepciones funcionales: desenfoque de fondo en la barra y paneles translúcidos sobre el globo. Nada se eleva en hover; los estados cambian borde o fondo.

## Shapes

Radios por jerarquía: 5px controles, 9px placas, 14px globo, píldora en chips de ejemplo. Borde 1px; los avisos llevan borde completo ámbar con un marcador circular (no barra lateral).

## Components

- **Placa de gráfico:** Placa con filete; scroll horizontal con desvanecido en el borde si el gráfico es más ancho; barrido de carga mientras se dibuja.
- **«Cómo lo sabemos»:** `details` cerrado por defecto; chevron que rota y apertura animada de altura.
- **Campos y chips:** fondo Placa alta; foco hielo de 2px; el chip elegido (`aria-pressed`) toma el hielo; campo inválido con borde coral.
- **Respuesta del modelo:** veredicto de 2,1rem con borde del color de la clase; barras que animan su ancho, con marcas de escala; alto mínimo para que el panel no salte.
- **Barra:** subrayado hielo que entra en la sección activa.
- **Globo:** caja Noche profunda con paneles translúcidos; en pantallas táctiles un dedo desplaza la página y dos giran.
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
