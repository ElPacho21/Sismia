import { fecha, n, pct } from "../lib/formato.js";
import Tabla from "./Tabla.jsx";

// «Cómo lo sabemos» de Los datos: de dónde salen, qué es una fila, qué se filtró paso a paso, qué se descartó por fuga.
const FUGA = [
  ["n_aftershocks", "Es la respuesta: la cantidad de réplicas."],
  ["has_aftershock", "Es la respuesta en versión sí/no."],
  ["n_events", "Es n_aftershocks + 1: la respuesta disfrazada (en este dataset coinciden en todas las filas)."],
  ["duration_days", "Cuánto duró la secuencia: se sabe recién cuando terminó."],
  ["extent_km", "Qué tan lejos llegaron las réplicas: se sabe al final."],
  ["max_generation", "Réplicas de réplicas: se sabe al final."],
  ["n_foreshocks", "Siempre 0, porque con mainshock = root el principal es el primer evento."],
  ["root_is_mainshock", "Siempre verdadera por construcción con mainshock = root."],
];

export default function ComoDatos({ pasos, metricas, regiones }) {
  const suma = (campo) => pasos.reduce((a, p) => a + p[campo], 0);
  const porRegion = Object.fromEntries(regiones.map((r) => [r.nombre, r]));
  const mcs = pasos.map((p) => p.mc);
  return (
    <>
      <h4>De dónde salen y cómo se obtienen</h4>
      <p>
        Del catálogo sísmico de <strong>USGS</strong> (servicio FDSN), descargado con un pipeline de <strong>Airflow</strong>. La corrida de las cinco regiones es del <strong>29 de octubre de 2026</strong>; el catálogo llega hasta el{" "}
        <strong>31 de diciembre de 2025</strong>. Las ventanas arrancan en 2003, salvo los Andes, que arrancan en 2008 porque antes tienen un régimen
        de magnitudes distinto.
      </p>
      <h4>Por qué cinco regiones y no el mundo entero</h4>
      <p>
        Elegimos cinco zonas de subducción del Cinturón de Fuego del Pacífico, donde ocurre la mayoría de los sismos grandes del mundo: Andes,
        Japón, Filipinas, Sumatra–Java (que mira al océano Índico, pero se la cuenta dentro del cinturón) y México–Centroamérica. No usamos el mundo
        entero por tres motivos:
      </p>
      <ol className="razones">
        <li>
          <strong>El método supone un catálogo homogéneo.</strong> Las réplicas se asignan con la distancia η = T · R<sup>d</sup> · 10<sup>−b·m</sup>. La
          distancia entre sismos se mide igual en todo el planeta (haversine); lo que falla es <code>d</code>, la dimensión fractal de los epicentros (1,5),
          que supone una ley de potencias: en el mundo entero los epicentros siguen los bordes de placa. Además, cada zona detecta desde una magnitud distinta
          (Mc), y mezclarlas hace que el umbral que separa réplicas de sismos de fondo deje de ser confiable.
        </li>
        <li>
          <strong>Encadena sismos sin relación.</strong> Con regiones muy grandes, el árbol de réplicas une zonas lejanas hasta armar clusters de miles de
          kilómetros. En un primer análisis, sólo con los Andes, ya aparecían dos de más de 1.500 km.
        </li>
        <li>
          <strong>El servicio tiene un tope.</strong> USGS rechaza las consultas de más de 20.000 eventos.
        </li>
      </ol>
      <p>
        Y no una sola región, como hicimos al principio (sólo los Andes), porque no alcanzaba: había 19 sismos grandes someros contra 22 profundos, muy pocos
        para comparar. Cada región se
        procesa por separado, con su propio Mc y su propio umbral, y después se juntan.
      </p>
      <h4>Qué es una fila</h4>
      <p>
        Una <strong>secuencia</strong>: un sismo principal (el que abre la secuencia, <code>mainshock = root</code>) con todas sus réplicas. Las
        réplicas se asignan con el método del vecino más cercano de Zaliapin y Ben-Zion, con un tope de distancia entre padre e hijo (
        <code>r_max = 3 · 10^(0,1238·M + 0,983)</code> km) para que no se encadenen sismos que no tienen relación.
      </p>
      <h4>Qué se filtró, paso por paso</h4>
      <Tabla
        leyenda="Filas que quedan en cada paso, por región"
        columnas={[
          { titulo: "Región", ver: (p) => p.region },
          { titulo: "Desde", ver: (p) => (porRegion[p.region] ? fecha(porRegion[p.region].desde) : ""), alinear: "num" },
          { titulo: "1. Descargados de USGS", ver: (p) => n(p.descargados_usgs), alinear: "num" },
          { titulo: "2. Limpios", ver: (p) => n(p.silver_limpios), alinear: "num" },
          { titulo: "3. Con magnitud ≥ Mc", ver: (p) => (p.mc ? `${n(p.sobre_mc)} (Mc ${n(p.mc, 1)})` : n(p.sobre_mc)), alinear: "num" },
          { titulo: "4. Secuencias", ver: (p) => n(p.secuencias), alinear: "num" },
        ]}
        filas={[
          ...pasos,
          {
            region: "Total",
            descargados_usgs: suma("descargados_usgs"),
            silver_limpios: suma("silver_limpios"),
            sobre_mc: suma("sobre_mc"),
            mc: 0,
            secuencias: suma("secuencias"),
          },
        ]}
        resaltar={(p) => p.region === "Total"}
      />
      <ol className="razones">
        <li>
          <strong>Descarga.</strong> Una consulta por región, con magnitud mínima de 3,5 (México–Centroamérica y Andes) o 4,0 (las demás).
        </li>
        <li>
          <strong>Limpieza.</strong> Se descartan los eventos sin los campos obligatorios y los repetidos por identificador. En esta corrida no se
          descartó ninguno ({n(suma("descargados_usgs") - suma("silver_limpios"))} filas).
        </li>
        <li>
          <strong>Umbral Mc.</strong> Se conservan sólo los eventos con magnitud mayor o igual a la de completitud de su región (de {n(Math.min(...mcs), 1)}{" "}
          a {n(Math.max(...mcs), 1)}, estimada por máxima curvatura): por debajo de eso el catálogo está incompleto y faltan las réplicas chicas. Es el
          paso que más filas saca ({pct((1 - suma("sobre_mc") / suma("silver_limpios")) * 100, 0)}).
        </li>
        <li>
          <strong>Secuencias.</strong> Los {n(suma("sobre_mc"))} eventos se agrupan en {n(suma("secuencias"))} secuencias. No es un filtro: las que
          tienen un único evento se quedan, y son las que no tuvieron réplicas.
        </li>
      </ol>
      <h4>Qué columnas se descartaron por fuga</h4>
      <p>Fuga es usar para predecir algo que sólo se sabe después. Ninguna de estas columnas entra al modelo:</p>
      <Tabla
        columnas={[
          { titulo: "Columna", ver: (f) => <code>{f[0]}</code> },
          { titulo: "Por qué sale", ver: (f) => f[1] },
        ]}
        filas={FUGA}
      />
      <p>
        Las columnas que valen siempre lo mismo en este dataset (<code>n_foreshocks</code> y <code>root_is_mainshock</code>) también salen. En el primer análisis, donde el principal era el sismo más grande de la secuencia (<code>mainshock = largest</code>), variaban, y
        ahí eran fuga: un premonitor se reconoce recién cuando llega el sismo mayor.
      </p>
      <p>
        De las {metricas.columnas.slice(4).reduce((a, g) => a + g.n, 0)} columnas que sí existen en el momento del sismo, el modelo final usa tres,
        combinadas en dos entradas: la magnitud sobre el umbral (<code>mainshock_mag − region_mc</code>) y la profundidad. Las otras doce se probaron
        agregándolas al modelo de a una, y ninguna mejora el f1 por más que el desvío (paso 4 de «El modelo»). Ocho de ellas (<code>n_prior_2d</code>,{" "}
        <code>n_prior_365d</code>, <code>prior_max_mag_365d</code>, <code>days_since_prior</code>, <code>prior_window_truncated</code>,{" "}
        <code>region_log10_eta0</code>, <code>dist_to_border_km</code> y <code>near_border</code>) no estaban en el dataset con el que empezamos a armar el
        modelo, así que se probaron después, con el dataset final y el mismo método. La latitud y la longitud sí estaban, pero se habían descartado al
        explorar los datos, por su correlación casi nula con las réplicas (Spearman 0,039 y −0,053); también se probaron después.
      </p>
      <p className="nota">
        Partición: las {n(metricas.particion.entrenamiento)} secuencias más antiguas ({fecha(metricas.particion.entrena_desde)} a{" "}
        {fecha(metricas.particion.entrena_hasta)}) entrenan; las {n(metricas.particion.test)} más nuevas ({fecha(metricas.particion.test_desde)} a{" "}
        {fecha(metricas.particion.test_hasta)}) son el test.
      </p>
    </>
  );
}
