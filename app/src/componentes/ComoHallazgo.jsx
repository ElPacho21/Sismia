import { n } from "../lib/formato.js";
import Grafico from "./Grafico.jsx";
import Tabla from "./Tabla.jsx";

// «Cómo lo sabemos» de Lo que encontramos: una hipótesis que se sostuvo (H1) y una que no (H4), cada una con su número.
export default function ComoHallazgo({ hipotesis, metricas }) {
  const { h1, h4, semaforo: sem } = hipotesis;
  const magMov = sem.movimientos.mainshock_mag;
  const profMov = sem.movimientos.mainshock_depth;
  return (
    <>
      <h4>Una hipótesis que se sostuvo: H1, «las réplicas crecen con la magnitud»</h4>
      <p>
        Se mide con η² (cuánta de la variación de las réplicas explican los tramos de magnitud M4–5, M5–6, M6–7 y M7 o más). Da{" "}
        <strong>η² = {n(h1.eta2, 3)}</strong>. Las medias suben de {n(h1.tramos[0].media, 2)} a {n(h1.tramos[3].media, 1)} réplicas entre el primer
        y el último tramo:
      </p>
      <Tabla
        columnas={[
          { titulo: "Tramo de magnitud", ver: (t) => t.tramo },
          { titulo: "Secuencias", ver: (t) => n(t.secuencias), alinear: "num" },
          { titulo: "Réplicas medias", ver: (t) => n(t.media, 2), alinear: "num" },
        ]}
        filas={h1.tramos}
      />
      <p>
        Correlaciones sobre todas las secuencias: Pearson {n(h1.pearson, 3)} y Spearman {n(h1.spearman, 3)}. Son bajas porque el 88 % de los datos
        son ceros; por eso la medida que sirve es η² por tramos, no la correlación lineal. En un primer análisis (sólo los Andes, con el
        principal como el sismo más grande de la secuencia) había dado η² = 0,377. Con el principal como el sismo que abre la secuencia, que es lo que se
        sabe en el momento de predecir, y con cinco regiones, la señal es más débil.
      </p>
      <p>
        <strong>Lo que aprendió el modelo coincide:</strong> cada punto de magnitud sobre el umbral multiplica las réplicas esperadas por{" "}
        <strong>{n(metricas.coeficientes.multiplicador_por_punto, 2)}</strong> (α de Utsu ≈ {n(metricas.coeficientes.alfa_utsu, 2)}, dentro del rango
        de 0,8 a 1 de la sismología). El gráfico da {n(h1.multiplicador_empirico, 2)} porque ajusta una recta sobre los <em>promedios</em> de cada
        tramo, y esos promedios los mueven los megasismos; el modelo ajusta sobre las {n(metricas.particion.entrenamiento)} secuencias de entrenamiento. Es el mismo orden de magnitud, no la
        misma cuenta.
      </p>

      <h4>Una hipótesis que no se sostuvo: H4, «con la magnitud alcanza para saber cuántas réplicas habrá»</h4>
      <p>
        Entre los <strong>{n(h4.n)} sismos de M6 o más</strong> la relación es sólo moderada: Pearson <strong>{n(h4.pearson, 2)}</strong>, Spearman{" "}
        <strong>{n(h4.spearman, 2)}</strong>. Y sismos de magnitud parecida dejan cantidades muy distintas: de {h4.minimo} a {n(h4.maximo)} réplicas, con un
        coeficiente de variación de {n(h4.coef_variacion, 1)}. Si se controla la profundidad (sólo los {n(h4.someros_n)} someros, menos de 70 km), el
        Spearman sube a {n(h4.someros_spearman, 2)} pero el Pearson sigue en {n(h4.someros_pearson, 2)}: hay relación, no determinación. En el primer análisis
        (sólo los Andes) había dado Pearson 0,43 y tampoco se sostuvo.
      </p>
      <p>
        Por eso el proyecto no predice un número exacto sino un <strong>intervalo</strong> (ninguna, pocas, moderadas, muchas) y por eso el modelo no
        usa sólo la magnitud.
      </p>

      <h4>El semáforo de las columnas</h4>
      <p>
        Es el del análisis exploratorio. Cada columna se mide contra las réplicas con la medida que corresponde a su tipo, y el valor absoluto cae en una zona:
      </p>
      <Tabla
        columnas={[
          { titulo: "Medida", ver: (f) => f[0] },
          { titulo: "Se usa para", ver: (f) => f[1] },
          { titulo: "Rojo", ver: (f) => `menos de ${n(f[2][0], 2)}`, alinear: "num" },
          { titulo: "Amarillo", ver: (f) => `${n(f[2][0], 2)} a ${n(f[2][1], 2)}`, alinear: "num" },
          { titulo: "Verde", ver: (f) => `más de ${n(f[2][1], 2)}`, alinear: "num" },
        ]}
        filas={[
          ["Spearman", "columnas numéricas", sem.cortes.correlacion],
          ["η²", "columnas de categorías (región) o de sí o no", sem.cortes.eta2],
          ["Separación estandarizada", "comparar dos grupos (someros y profundos)", sem.cortes.separacion],
        ]}
      />
      <p>
        Se usa Spearman y no Pearson porque mira el orden y no exige una recta: con el 88 % de ceros y unas pocas secuencias de miles de réplicas, Pearson
        lo mueven los extremos. En amarillo valen hasta dos <strong>movimientos</strong> (partir la población, controlar una tercera variable o cambiar la
        escala); después la hipótesis se declara inconclusa. La magnitud y la profundidad usaron los dos: la magnitud, sólo M6 o más y después sólo los someros; la profundidad, tres franjas
        (η²) y después sólo M6 o más. En el semáforo la magnitud se mide con Spearman, como todas las columnas numéricas, para
        compararla con las demás; la H1 se midió además con η² por tramos de magnitud (abajo), y también da amarillo. Los η² de la región y de las dos columnas de sí o no dan menos de
        0,001: los mueven unas pocas secuencias de miles de réplicas, porque η² mide varianza.
      </p>
      <Grafico
        url="specs/semaforo.json"
        descripcion="Las tres columnas que usa el modelo sobre el semáforo, con el antes y el después de los movimientos de la magnitud y la profundidad."
      />
      <p>
        <strong>H1 se sostuvo:</strong> la magnitud arranca en amarillo ({n(magMov[0].valor, 3)}) y con cada movimiento se acerca al verde (
        {n(magMov[2].valor, 3)}). <strong>H3, a medias:</strong> la profundidad arranca en rojo ({n(profMov[0].valor, 3)}); agrupada en tres franjas
        sigue en rojo, y recién mirando los sismos de M6 o más pasa a amarillo ({n(profMov[2].valor, 3)}). El umbral de la región no tenía hipótesis
        propia: entra restado a la magnitud porque corrige un sesgo entre regiones (paso 3 de «El modelo»). Las otras columnas dan todas en rojo, y
        agregadas al modelo no lo mejoran (paso 4):
      </p>
      <Tabla
        leyenda="Las columnas que existen en el momento del sismo, sobre todas las secuencias"
        columnas={[
          { titulo: "Columna", ver: (c) => <code>{c.columna}</code> },
          { titulo: "Medida", ver: (c) => c.medida },
          { titulo: "Valor", ver: (c) => (Math.abs(c.valor) < 0.0005 ? "< 0,001" : n(c.valor, 3)), alinear: "num" },
          { titulo: "Zona", ver: (c) => c.zona },
          { titulo: "Decisión", ver: (c) => (sem.usa_el_modelo.includes(c.columna) ? "Entra al modelo" : "Sale: se probó en el modelo y no lo mejora (paso 4)") },
        ]}
        filas={[...sem.columnas].sort((a, b) => sem.usa_el_modelo.includes(b.columna) - sem.usa_el_modelo.includes(a.columna))}
        resaltar={(c) => sem.usa_el_modelo.includes(c.columna)}
      />

      <h4>Cómo se construyó el gráfico</h4>
      <ul className="razones">
        <li>
          El eje horizontal es la <strong>magnitud sobre el umbral de la región</strong> (<code>mag − Mc</code>) y no la magnitud cruda. Con la cruda,
          el tramo M4–4,5 tiene más réplicas que el siguiente porque México detecta desde 4,2 y las demás regiones desde 4,6 o 4,7.
        </li>
        <li>
          Cada punto es un tramo de 0,5 puntos con al menos 10 secuencias ({h1.tramos_grafico} tramos). El tamaño es la cantidad de secuencias: los
          puntos de la derecha son pocas y su promedio es inestable.
        </li>
        <li>
          Los mismos puntos, con dos ejes verticales. El <strong>lineal</strong> muestra la forma: las réplicas medias van de {n(0.2, 1)} a más de 100, así
          que los primeros tramos quedan aplastados contra el cero y el final se dispara. El <strong>logarítmico</strong> separa esos primeros tramos y, en
          esa escala, una recta es un crecimiento por un factor constante.
        </li>
        <li>
          La curva punteada es la misma en los dos paneles: una recta ajustada a <code>log(media)</code> de los tramos (regresión lineal) y vuelta con <code>exp()</code>. En el logarítmico se ve recta; en el lineal, curva.
        </li>
      </ul>

      <h4>Cómo se construyó el gráfico de los casos atípicos</h4>
      <ul className="razones">
        <li>
          Un punto por secuencia (las {n(metricas.particion.entrenamiento + metricas.particion.test)}). Horizontal: la magnitud del principal, cruda, para que se
          lea directo. Vertical: las réplicas, en escala logarítmica que incluye el 0 (<em>symlog</em>), porque la mayoría tiene 0 y unas pocas, miles.
        </li>
        <li>
          «Después vino un sismo mayor»: la magnitud mayor de la secuencia (sale de los archivos de eventos de cada región) es más grande que la del
          principal. Con <code>mainshock = root</code> el principal es el que abre la secuencia, así que todas las réplicas se le cuentan a él.
        </li>
        <li>
          Los grupos se marcan con la <strong>forma</strong> y no con el color, porque el color es siempre la clase de réplicas. Los cinco rótulos salen por
          regla: las dos secuencias con más réplicas entre las que tuvieron un sismo mayor después, las dos con más réplicas entre las demás y, de los M7 o
          más con 2 réplicas o menos, la que tiene menos réplicas y está más profunda.
        </li>
        <li>
          Cuando analizamos los errores del modelo, que los sismos chicos con más de 10 réplicas fueran el comienzo de un sismo mayor había quedado como
          una posibilidad sin comprobar. Con la magnitud mayor de cada secuencia se comprueba: pasa en los {metricas.atipicos.chicos_con_muchas_mayor_despues}{" "}
          de {metricas.atipicos.chicos_con_muchas}.
        </li>
      </ul>
    </>
  );
}
