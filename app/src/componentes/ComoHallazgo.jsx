import { n } from "../lib/formato.js";
import Tabla from "./Tabla.jsx";

// «Cómo lo sabemos» de Lo que encontramos: una hipótesis que se sostuvo (H1) y una que no (H4), cada una con su número.
export default function ComoHallazgo({ hipotesis, metricas }) {
  const { h1, h4 } = hipotesis;
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
        son ceros; por eso la medida que sirve es η² por tramos, no la correlación lineal. En la Entrega 2 (sólo los Andes, con{" "}
        <code>mainshock = largest</code>) había dado η² = 0,377; con <code>root</code> y cinco regiones la señal es más débil y es lo honesto.
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
        Spearman sube a {n(h4.someros_spearman, 2)} pero el Pearson sigue en {n(h4.someros_pearson, 2)}: hay relación, no determinación. En la Entrega 2 había
        dado Pearson 0,43 y también se refutó.
      </p>
      <p>
        Por eso el proyecto no predice un número exacto sino un <strong>intervalo</strong> (ninguna, pocas, moderadas, muchas) y por eso el modelo no
        usa sólo la magnitud.
      </p>

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
          El eje vertical es <strong>logarítmico</strong>: las réplicas medias van de {n(0.2, 1)} a más de 100. En esa escala una recta es un
          crecimiento por un factor constante. La recta punteada se ajusta dentro del gráfico: <code>log(media)</code>, regresión lineal, y se vuelve
          con <code>exp()</code>.
        </li>
      </ul>
    </>
  );
}
