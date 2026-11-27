# Guion de la exposición final · Sisimia

*5K10-12 · Predictor de Réplicas de un Sismo · viernes 27/11 desde las 19:00*

20 minutos, sólo la aplicación (https://sisimia.vercel.app), y en el minuto 20 se corta. Pensado para **seis integrantes**
(A a F): pongan el nombre de cada uno en la tabla.

## El reparto

| Quién | Minutos | Parte | Tiempo total |
|---|---|---|---|
| **A** ……… | 0:00 – 3:20 | Portada + Los datos (1): casi todo es cero | **3:20** |
| **B** ……… | 3:20 – 6:20 | Los datos (2): regiones, secuencias y fuga | **3:00** |
| **C** ……… | 6:20 – 9:40 | Lo que encontramos | **3:20** |
| **D** ……… | 9:40 – 12:20 | El modelo (1): pasos 1 a 3 | |
|  | 19:00 – 20:00 | Cierre · qué quedó sin responder | **3:40** |
| **E** ……… | 12:20 – 15:20 | El modelo (2): pasos 4 a 6, validación, test y permutación | **3:00** |
| **F** ……… | 15:20 – 16:40 | Copa · Explorá | |
|  | 16:40 – 19:00 | Copa · Probá el modelo, con el caso en vivo | **3:40** |

Todos hablan entre 3:00 y 3:40. D cierra porque el primer punto del cierre (el sesgo de los Andes) sale de su paso 3.

**Una diferencia con la consigna:** «Probá el modelo» tiene pocas cosas que tocar y se hace rápido, así que la copa entera
(Explorá y Probá) queda en manos de F y dura 3:40 en lugar de 5. Esos minutos pasan a «El modelo», que es la sección más
cargada: el tallo termina en el 15:20 en lugar del 14.

### Quién comparte pantalla

- **F comparte todo el tiempo**: hace la copa entera y no habla hasta el minuto 15, así que puede ir bajando por la página
  mientras los demás explican. Quien habla le pide «bajá al gráfico de…», o F sigue el guion.
- **A es el suplente**: termina en el minuto 3:20 y tiene la URL abierta y lista. Si se le corta a F, A comparte y sigue
  desde donde quedó.
- Ventana del navegador (no la pantalla entera), **zoom 125 %**, cámara prendida para quien habla.
- Antes de arrancar: abrir la página un rato antes (la API arranca en frío) y **bajar una vez hasta el globo** para que se cargue.

### Regla para todos

La cátedra pone más nota a **cómo funciona** y **por qué se decidió**, y casi nada a describir lo que se ve. Cada bloque de abajo
marca con **Por qué** lo que hay que decir sí o sí. Lo marcado *(si sobra tiempo)* es lo primero que se corta. Con tres
minutos por persona no hay margen: nadie le come tiempo al siguiente.

---

## A · Portada (0:00 – 2:00)

**En pantalla:** el principio de la página, la pregunta y los tres números.

- La pregunta: *cuando ocurre un sismo, ¿cuántas réplicas podemos esperar?* Una **réplica** es un sismo más chico que viene
  después del principal, cerca y por su causa. Al principal con todas sus réplicas le decimos **secuencia**.
- La respuesta en una frase: **el modelo sirve para priorizar qué sismos vigilar, no para emitir alertas.**
- Los tres números:
  1. **0,50 contra 0,24** de f1 macro en el test. El 0,24 es el **piso**: un modelo que contesta siempre «ninguna réplica». El
     modelo más que lo duplica, en sismos que no vio al entrenar.
  2. **59,7 %**: de las secuencias que tuvieron réplicas, el modelo avisó en 6 de cada 10. **Por qué lo aceptamos:** lo
     ajustamos para avisar de más; el costo es que 3 de cada 4 avisos son falsas alarmas. Por eso «priorizar» y no «alertar».
  3. **×7,6**: cada punto de magnitud sobre el umbral de la región multiplica las réplicas esperadas por 7,6. Es lo que más
     pesa en el modelo.

## A · Los datos (1): casi todo es cero (2:00 – 3:20)

**En pantalla:** «1 · Los datos» y las barras por intervalo de réplicas.

- **El 88 % de las secuencias no deja ninguna réplica**, y sólo 142 de 21.292 dejan más de diez.
- **Por qué importa:** contestar siempre «ninguna» acierta el 89 % de las veces sin servir para nada. Ese es el piso.
  Por eso no medimos con accuracy sino con **f1 macro**: calcula el f1 de cada una de las cuatro clases y las promedia con el
  mismo peso, así que equivocarse en las clases raras (las que tienen réplicas) pesa igual que en «ninguna».

> **Pase:** «B les cuenta de dónde salen estas 21.292 secuencias.»

## B · Los datos (2): regiones, secuencias y fuga (3:20 – 6:20)

**En pantalla:** el recuadro rojo de los Andes, el mapa del Cinturón de Fuego y los recuadros de columnas.

- **El problema del principio** (recuadro rojo): empezamos sólo con los Andes y había 41 sismos de M6 o más. No alcanzaba.
- **Mapa del Cinturón de Fuego:** sumamos cinco zonas de subducción (Andes, Japón, Filipinas, Sumatra–Java, México–Centroamérica),
  donde ocurren la mayoría de los sismos grandes. **Por qué no el planeta entero:** el método que arma las secuencias encadena
  sismos sin relación cuando la zona es muy grande (aparecían «secuencias» de 3.610 km). Procesando cada región por separado y
  con un tope de distancia entre réplica y sismo, la más extensa hoy mide 533 km. *(si sobra tiempo: además cada zona detecta
  desde una magnitud distinta.)*
- **Cómo se arma una secuencia:** un pipeline de **Airflow** baja el catálogo de USGS por región, se queda con los sismos
  por encima del **Mc** (la magnitud desde la que esa región registra todos los sismos; por debajo faltan réplicas chicas) y
  agrupa con el método del vecino más cercano de Zaliapin y Ben-Zion: una «distancia» que combina tiempo, espacio y magnitud,
  y cada sismo cuelga del más cercano anterior.
- **Recuadros de columnas:** de 27 columnas, el modelo usa 3. **El filtro es una pregunta: ¿esta columna existiría en el
  momento del sismo?** Las de **fuga** no (duración, extensión, cantidad de réplicas: se saben cuando la secuencia terminó).
- **El segundo problema** (recuadro rojo): al principio el sismo principal era el **más grande** de la secuencia, pero eso
  también es fuga: en el momento nadie sabe si después viene uno mayor. Por eso el principal es **el que abre** la secuencia.
  El costo: el M7,3 del 9/3/2011 en Ōfunato figura con 2.544 réplicas, pero casi todas son del M9,1 de dos días después.

> **Pase:** «Ya sabemos qué columnas existen en el momento del sismo. C les muestra cuáles se mueven con las réplicas.»

---

## C · Lo que encontramos (6:20 – 9:40)

**En pantalla:** «2 · Lo que encontramos» y los dos paneles (eje lineal y logarítmico).

- El título es el hallazgo: **las réplicas no crecen de a poco con la magnitud, se multiplican.**
- **Cómo leer el gráfico:** el eje horizontal es cuánto supera el sismo el umbral de su región. En lineal la curva está plana
  hasta +2 y se dispara; **en logarítmico queda casi recta, y una recta en escala log es un crecimiento por un factor
  constante.** De 0,2 réplicas de media apenas sobre el umbral a 128 cuando lo supera por 2,5 a 3 puntos.
- **Por qué el eje es magnitud sobre el umbral y no la cruda:** con la cruda, el tramo M4–4,5 tenía más réplicas que el
  siguiente, porque México detecta desde 4,2 y las otras regiones desde 4,6 o 4,7.
- *(si sobra tiempo)* El modelo coincide: ×7,6 por punto, que en sismología es un α de Utsu de 0,88, dentro del rango 0,8–1.
- **Barras de hipótesis** (escribimos qué esperábamos *antes* de medir):
  - **H1 se sostuvo**, «las réplicas crecen con la magnitud»: de cada 100 sismos de M4–5, prácticamente ninguno tiene más
    de 10 réplicas; de cada 100 de M7 o más, 64.
  - **H3 a medias**, «los someros dejan más réplicas»: con todas las secuencias casi no hay diferencia. Sólo en M6 o más:
    23 de cada 100 someros contra 3 de cada 100 profundos. **Por eso la profundidad entra al modelo.**
- **Cómo lo medimos** (una frase, señalando el semáforo en «Cómo lo sabemos»): **usamos Spearman y no Pearson** porque con
  88 % de ceros y unas pocas secuencias de miles de réplicas, Pearson lo mueven los extremos; Spearman mira el orden.
- **Casos atípicos · H4 no se sostuvo**, «con la magnitud alcanza»: entre los 490 sismos de M6 o más, Spearman 0,50, y
  sismos parecidos dejan de 0 a 2.544 réplicas.
  - **Triángulos:** secuencias donde después vino un sismo mayor. Son el 3,8 % de las secuencias pero el 42 % de las
    réplicas: es el costo de tomar como principal el que abre.
  - **Cuadrados:** M7 o más casi sin réplicas; 6 de los 7 están a más de 290 km de profundidad.

> **Pase:** «Las réplicas se multiplican con la magnitud, la profundidad pesa en los grandes, y la magnitud sola no alcanza.
> Con eso D les cuenta cómo armamos el modelo.»

---

## D · El modelo (1): pasos 1 a 3 (9:40 – 12:20)

**En pantalla:** «3 · El modelo». Cada título de paso es la decisión que tomamos.

- **Paso 1 · Un intervalo y no un número:** de los 97 sismos de M6,0 exactos, 42 no dejaron réplicas, 32 dejaron 1 o 2, 21
  entre 3 y 10 y 2 más de 10. Con esa dispersión (la varianza es entre 15 y 1.110 veces la media) un número exacto no tiene
  sentido: predecimos **ninguna (0), pocas (1–2), moderadas (3–10) o muchas (11+)**.
- **Paso 2 · De la logística a Poisson:** con las mismas dos entradas, 0,378 → 0,442 de f1. **Por qué:** Poisson está hecha
  para contar. **Cómo funciona:** primero estima cuántas réplicas espera (μ = exp(b₀ + b₁·magnitud + b₂·profundidad)), y con
  la distribución de Poisson de esa μ calcula la probabilidad de cada intervalo.
- **Paso 3 · Magnitud sobre el umbral:** el modelo subestimaba México (hubo 1,36 veces las réplicas esperadas) y
  sobreestimaba Filipinas (0,50). México registra desde M4,2 y Filipinas desde M4,7; restando el umbral quedan en 0,83 y
  0,77. **El f1 casi no cambia (0,442 → 0,444): lo elegimos porque corrige el sesgo entre regiones, no por el f1.**

> **Pase:** «E sigue con lo que probamos después.»

## E · El modelo (2): pasos 4 a 6, validación, test y permutación (12:20 – 15:20)

- **Paso 4 · No sumamos columnas:** probamos las otras doce de a una y todas juntas; ninguna sale de la banda de un desvío
  (0,444 ± 0,021). El modelo confirma lo que mostró C.
- **Paso 5 · Poisson con empuje:** ninguna otra familia (random forest, gradient boosting, binomial negativa) le ganó.
  **El empuje** es cuánto se anima el modelo a decir «hay réplicas»: divide la probabilidad de cada clase por lo común que es,
  elevado al empuje. Con 0,4 el recall de «pocas» sube de 0,21 a 0,44 y el de «ninguna» baja de 0,93 a 0,76.
  **Regla:** el empuje más alto con el f1 a un desvío del mejor. Preferimos avisar de más antes que perder un sismo con réplicas.
- **Paso 6 · Los cortes:** los elegimos nosotros, así que probamos otras cuatro formas de cortar: Poisson gana en todas.
  Con más intervalos el f1 baja para todos porque la pregunta es más difícil: se compara Poisson contra la logística dentro
  de cada fila, no las filas entre sí.
- **Gráfico del camino completo:** del piso (línea punteada) al elegido, en turquesa lo adoptado y en rosa lo descartado.
  **Por qué este si varios dan parecido:** Poisson le gana al resto por más de un desvío **y es una fórmula cerrada que entra
  en la página**; la magnitud sobre el umbral, por el sesgo (paso 3); el empuje, por la regla.
- **Cómo validamos:** partición **cronológica** (los sismos más viejos entrenan, los de 2021–2025 son el test) porque el
  modelo va a predecir sismos futuros; para elegir, `TimeSeriesSplit` de 5 folds: cada fold entrena con todo lo anterior y
  valida con el tramo siguiente. El test se usó una sola vez: **0,50 contra 0,24**.
- **Para qué sirve:** en el test, 278 avisos correctos contra 792 falsas alarmas. Priorizar, no alertar.
- **Permutación:** con el modelo ya entrenado, se desordena una columna en el test y se mide cuánto baja el f1. Sin la
  magnitud cae de 0,50 a 0,25, casi el piso; sin la profundidad o sin el umbral apenas baja. **El modelo se apoya en la
  magnitud.**

> **Pase:** «Ahora F les muestra cómo se usa todo esto.»

---

## F · Copa · Explorá (15:20 – 16:40) · cómo funciona, no recorrerlo entero

- Cada punto del globo es **un sismo principal**: el tamaño es la magnitud y el color, la clase de réplicas. Los anillos
  marcan los M7 o más, y cada región muestra su f1 en el test.
- **Por defecto se ven sólo las secuencias de test**, las que el modelo no vio. **Por qué:** con «todas» se suman las de
  entrenamiento y el modelo se ve mejor de lo que es.
- **Pintar según:** clase real contra la que dijo el modelo, para ver dónde acierta.
- Click en un punto: **anima la secuencia** con tiempo logarítmico, porque casi todas las réplicas llegan en las primeras
  horas.
- **Las barras de abajo** responden a los mismos filtros: cada barra es lo que pasó, y sus colores, lo que dijo el modelo.
  Si acertara siempre, cada barra sería de un solo color.
- **En vivo:** elegir la región **Japón** en el filtro. Esa región pasa sola a «Probá el modelo», y con eso se pasa a la
  segunda parte: «la región que elegimos ya está cargada; ahora probamos un sismo nuevo».

## F · Copa · Probá el modelo (16:40 – 19:00) · el caso en vivo

Seguir este orden (ya está comprobado lo que contesta):

1. **Ejemplo «M6,0 en Japón, somero»** (30 km) → **moderadas (3–10)**, 3,0 réplicas esperadas. Leer las barras: 57 %
   moderadas, 38 % pocas. **Cómo:** calcula las réplicas esperadas con la fórmula y de ahí la probabilidad de cada intervalo.
2. **Cambiar la región a México** (Mc 4,2), misma magnitud → 6,7 réplicas esperadas. **Por qué:** el mismo M6,0 está 1,8 puntos
   sobre el umbral de México y 1,4 sobre el de Japón.
3. **Cambiar a Filipinas** (Mc 4,7) → 2,4 réplicas esperadas. La clase más probable es **pocas**, pero contesta **moderadas**
   y aparece el cartel del **empuje**: es el paso 5 funcionando en vivo.
4. **Volver a Japón y llevar la profundidad a 300 km** → **ninguna**, 0,2 esperadas: cada 100 km de profundidad multiplica
   las réplicas por 0,37. Mostrar que **la pista de cada slider está pintada con lo que contestaría el modelo en ese punto.**
5. **Subir la magnitud a la zona rayada** (más de M9,1) → aviso «fuera de lo que el modelo vio»: calcula igual pero avisa que
   es una extrapolación. Lo que no tiene sentido (magnitud mayor a 10, profundidad mayor a 800 km) se rechaza.
6. **De dónde sale el cálculo:** la página llama a una API en FastAPI; si no responde en 4 segundos, calcula lo mismo en el
   navegador con los coeficientes del modelo y lo avisa. Las dos se verificaron contra el modelo original de scikit-learn
   en 6.992 casos: misma clase en el 100 %.

> **Pase:** «Para cerrar, D les cuenta qué quedó sin responder.»

---

## D · Cierre (19:00 – 20:00) · qué quedó sin responder

Tres cosas, en una frase cada una:

1. **Los Andes:** aun con el umbral (el paso 3), hubo sólo 0,26 veces las réplicas esperadas. El Mc no lo explica y no
   sabemos qué sí.
2. **Las falsas alarmas en M5,4 a M5,7 mar adentro:** creemos que el Mc real ahí es más alto que el de la región y que
   muchas profundidades de 10 km son un valor por defecto del catálogo. **Es una hipótesis nuestra, no la verificamos.**
3. **Si va a venir un sismo mayor:** el 42 % de las réplicas son de secuencias donde después vino uno más grande, y en el
   momento del sismo el modelo no tiene forma de saberlo. Sería otra pregunta: actualizar la predicción con las réplicas de
   las primeras horas.

Cerrar con la frase de la portada: **sirve para priorizar qué sismos vigilar, no para emitir alertas.**

---

## Preguntas que nos pueden hacer (los 3 minutos finales)

El docente pregunta a integrantes puntuales. Cada uno tiene que poder contestar lo suyo **y** lo de al lado.

| Pregunta | Quién | Respuesta corta |
|---|---|---|
| ¿Por qué f1 macro y no accuracy? | A | El 88 % es «ninguna»: el piso acierta 89 % y no detecta nada. El f1 macro da el mismo peso a las cuatro clases. |
| ¿Qué es el piso y para qué sirve? | A | Contestar siempre «ninguna», sin mirar columnas. Es lo mínimo a superar: un modelo sirve si lo deja atrás por más que el ruido. |
| ¿Qué es el Mc y cómo se estima? | B | La magnitud desde la que la región registra todos los sismos; se estima por máxima curvatura (el pico del histograma de magnitudes). |
| ¿Qué es fuga? Un ejemplo. | B | Usar algo que se sabe recién después: `duration_days`, `extent_km`, o elegir como principal el más grande. |
| ¿Por qué Spearman y no Pearson? | C | Mira el orden, no exige una recta; Pearson lo mueven los ceros y los megasismos. |
| ¿Por qué la profundidad entra si da rojo con todas las secuencias? | C | Porque en M6 o más separa (23 contra 3 de cada 100), y ahí es donde importan las réplicas. |
| ¿Por qué un intervalo y no el número de réplicas? | D | Sismos de la misma magnitud dejan de 0 a cientos de réplicas: la varianza es decenas o miles de veces la media. |
| ¿Cómo pasa Poisson de un número a una clase? | D | Estima las réplicas esperadas μ y con la distribución de Poisson calcula la probabilidad de 0, de 1–2, de 3–10 y de 11+. |
| ¿Por qué Poisson y no random forest? | E | Le gana por más de un desvío y es una fórmula cerrada que se puede escribir dentro de la página. |
| ¿Por qué partición cronológica? | E | El modelo va a predecir sismos futuros; al azar se mezclarían réplicas del futuro en el entrenamiento. |
| ¿Por qué el test da más que la validación (0,50 contra 0,44)? | E | «Muchas» tiene sólo 29 casos en el test (dos o tres aciertos mueven mucho su f1) y el modelo final entrena con más datos que cada fold. |
| ¿Qué hace exactamente el empuje? | E / F | Divide la probabilidad de cada clase por su frecuencia elevada a 0,4: favorece las clases raras (las que tienen réplicas). |
| ¿Por qué el globo muestra sólo test por defecto? | F | Porque en entrenamiento el modelo se ve mejor de lo que es. |
| ¿Qué pasa si la API no anda? | F | Calcula en el navegador con la misma fórmula y lo avisa; verificadas en 6.992 casos. |

## Ensayo

- Cronometrar cada bloque por separado y después la corrida entera. Si alguien se pasa, recorta primero lo marcado *(si sobra
  tiempo)*.
- Ensayar los pases: la última frase de cada uno es la que da pie al siguiente. Con seis personas, los cambios de voz son
  donde más tiempo se pierde.
- F ensaya la copa de memoria: qué filtro tocar en el globo y los pasos de región y slider del caso en vivo.
- Probar la URL en el navegador que se va a usar para compartir (sólo se probó en Edge).
