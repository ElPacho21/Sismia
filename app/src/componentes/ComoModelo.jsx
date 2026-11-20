import { fecha, n, pct } from "../lib/formato.js";
import Grafico from "./Grafico.jsx";
import Tabla from "./Tabla.jsx";

// «Cómo lo sabemos» de El modelo: métrica, piso, validación, comparación, ajuste, test, errores y en qué se apoya.
// Todo va en gráficos salvo la tabla de comparación (media y desvío), que la consigna pide como tabla.
export default function ComoModelo({ metricas, modelo }) {
  const m = metricas;
  const ajuste = m.ajuste;
  const comparacion = Object.entries(m.comparacion_validacion).sort((a, b) => b[1][0] - a[1][0]);
  const perm = m.importancia_permutacion;
  const probadas = m.columnas_probadas;
  const previos2d = m.columnas_nuevas.n_prior_2d;
  const varMedia = Object.values(m.intervalos_por_tramo).map((t) => t.var_media);
  const cociente = m.real_sobre_esperadas;
  const comp = m.comparacion_validacion;
  const empuje0 = ajuste.trade_off_empuje["0"];
  const empujeElegido = ajuste.trade_off_empuje[String(modelo.empuje)];
  return (
    <>
      <h4>La métrica y por qué</h4>
      <p>
        <strong>f1 macro</strong>: se calcula el f1 de cada una de las cuatro clases y se promedian con el mismo peso. El 88 % de las secuencias son «ninguna»,
        así que la accuracy engaña: el piso (contestar siempre «ninguna») acierta el {n(m.piso.accuracy_test * 100, 1)} % en el test y no detecta
        ninguna réplica. El f1 macro penaliza eso.
      </p>
      <h4>El piso</h4>
      <p>
        Un modelo que contesta siempre «ninguna», sin mirar ninguna columna: f1 macro <strong>{n(m.piso.f1_validacion, 3)} ± {n(m.piso.desvio_validacion, 3)}</strong> en
        validación y {n(m.piso.f1_test, 3)} en test. Un modelo sirve si deja ese número atrás por más que el ruido.
      </p>
      <h4>Cómo se armó la validación</h4>
      <p>
        Partición <strong>cronológica</strong> (no al azar, porque el modelo va a predecir sismos futuros): las {n(m.particion.entrenamiento)} secuencias más
        viejas ({fecha(m.particion.entrena_desde)} a {fecha(m.particion.entrena_hasta)}) entrenan y las {n(m.particion.test)} más nuevas son el test, que se usa
        una sola vez. Para elegir y ajustar, el entrenamiento se valida con <code>TimeSeriesSplit</code> de 5 folds: cada fold entrena con todo lo anterior y
        valida con el tramo siguiente. A la derecha de cada fold, el f1 del modelo elegido.
      </p>
      <Grafico url="specs/folds.json" descripcion="Los cinco folds de la validación temporal: con qué tramo entrena y con cuál valida cada uno." />

      <h4>Comparación de modelos (media y desvío del f1 macro en validación)</h4>
      <Tabla
        columnas={[
          { titulo: "Modelo", ver: (f) => f[0] },
          { titulo: "f1 macro", ver: (f) => n(f[1][0], 3), alinear: "num" },
          { titulo: "Desvío", ver: (f) => n(f[1][1], 3), alinear: "num" },
        ]}
        filas={comparacion}
        resaltar={(f) => f[0].startsWith("Poisson elegido")}
      />
      <p>
        Los tres Poisson caen dentro de un desvío entre sí, y todos le ganan al resto por más de un desvío. El tercero es el elegido: el segundo con
        alpha y empuje ajustados. Entre los dos primeros, se eligió <strong>Poisson con mag_sobre_mc y profundidad</strong> no por el f1, que empata con el de
        magnitud cruda, sino porque corrige el sesgo entre regiones (paso 3 de «El modelo»). Los dos tienen dos coeficientes y son una fórmula cerrada que se
        puede escribir dentro de la página, cosa que no pasa con random forest ni gradient boosting. La binomial negativa terminó contestando siempre «ninguna»
        (la dispersión la dominan los megasismos de hasta 2.544 réplicas). Además de la tabla, con Poisson se probaron dos columnas más, de a una: la región
        ({n(probadas.region[0], 3)} ± {n(probadas.region[1], 3)}) y los sismos de los 30 días previos ({n(probadas.previos[0], 3)} ±{" "}
        {n(probadas.previos[1], 3)}), contra {n(probadas.base[0], 3)} ± {n(probadas.base[1], 3)} sin ellas: ninguna mejora por más que el desvío. Después, con el dataset final y el
        mismo método, se probaron las otras diez columnas que existen en el momento del sismo: tampoco mejora ninguna, ni sola ni todas juntas (paso 4). La
        única con algo de información propia es la cantidad de sismos en los 2 días previos: entre los sismos de M5–6, dejan réplicas el{" "}
        {pct(previos2d.con_replicas_pct["5–6"]["0"], 1)} de los que no tuvieron actividad previa y el {pct(previos2d.con_replicas_pct["5–6"]["1–4"], 1)} de
        los que tuvieron de 1 a 4 sismos. Pero sólo el {pct(previos2d.pct_con_previos, 0)} de las secuencias tuvo actividad previa, y el f1 casi no se mueve
        ({n(m.columnas_nuevas.celda54.columnas.n_prior_2d.f1, 3)}).
      </p>
      <p className="nota">
        Al recalcular la tabla para esta página, dos filas no dan exactamente lo mismo que en el análisis original: random forest balanceado (
        {n(m.comparacion_medida_en_build["random forest (balanced)"][0], 3)} contra {n(m.comparacion_validacion["random forest (balanced)"][0], 3)}) y gradient boosting
        balanceado ({n(m.comparacion_medida_en_build["gradient boosting (balanced)"][0], 3)} contra{" "}
        {n(m.comparacion_validacion["gradient boosting (balanced)"][0], 3)}). Ninguna es el modelo elegido; la causa probable es la versión de scikit-learn, pero no la
        verificamos. El resto, incluidos el piso y Poisson, coincide dentro de 0,001.
      </p>

      <h4>El ajuste del elegido</h4>
      <p>
        <strong>alpha</strong> (regularización), con empuje 0. Entre 0,001 y 1 el f1 casi no cambia (dentro del desvío): con dos coeficientes el modelo casi no
        necesita regularizar. Se eligió <strong>{n(modelo.alpha, 3)}</strong>; con 10 cae a {n(ajuste.alpha["10"][0], 3)}.
      </p>
      <Grafico url="specs/alpha.json" descripcion="f1 macro en validación (media y desvío) para cada valor de alpha." />
      <p>
        <strong>empuje</strong>: el modelo dice «hay réplicas» con más facilidad a costa de más falsas alarmas (divide cada probabilidad por lo común que es esa
        clase, elevado al empuje). Se prefiere avisar de más antes que perder un caso. Regla: el empuje más alto cuyo f1 macro esté a un desvío del mejor. Eligió{" "}
        <strong>{n(modelo.empuje, 1)}</strong>: el recall de «ninguna» baja y el de las clases con réplicas sube (el gráfico está en el paso 5, arriba).
      </p>

      <h4>El resultado en el test y dónde se equivoca</h4>
      <p>
        Entrenado con todo el entrenamiento y evaluado <strong>una vez</strong> en el test: f1 macro <strong>{n(m.final.f1_test, 3)}</strong> contra {n(m.piso.f1_test, 3)}{" "}
        del piso (accuracy {n(m.final.accuracy_test, 3)} contra {n(m.piso.accuracy_test, 3)}: baja porque el modelo se anima a avisar). Está por encima del f1 de validación (
        {n(m.final.f1_validacion, 3)} ± {n(m.final.desvio_validacion, 3)}); lo atribuimos a que «muchas» tiene sólo {m.reporte_test["muchas (11+)"].support} casos en el test (dos o tres
        aciertos más mueven mucho su f1) y a que el modelo final se entrena con más datos que cada fold.
      </p>
      <Grafico url="specs/reporte.json" descripcion="Precisión, recall y f1 de cada clase en el test." />
      <p>
        La matriz de confusión: cada fila es lo que pasó y cada columna, lo que dijo el modelo. El número es la cantidad de secuencias y la intensidad, la proporción
        de la fila (el recall queda en la diagonal).
      </p>
      <Grafico url="specs/confusion.json" descripcion="Matriz de confusión en el test." />
      <p>
        De las {n(m.avisos_test.con_replicas)} secuencias del test que tuvieron réplicas, el modelo avisó en {n(m.avisos_test.avisados_pct, 1)} %. El costo: {n(m.avisos_test.falsas_alarmas)} falsas
        alarmas contra {n(m.avisos_test.avisos_correctos)} avisos correctos. <strong>Sirve para priorizar qué sismos vigilar, no para emitir alertas.</strong>
      </p>
      <Grafico url="specs/tramos.json" descripcion="Qué proporción del test acierta el intervalo, por tramo de magnitud." />
      <p>
        Acierta más en los extremos (M4–5 casi siempre «ninguna»; M7 o más, «muchas») y menos en el medio, porque ahí las réplicas esperadas quedan cerca de los cortes de 2 y 10.
      </p>
      <p className="nota">
        Dos tipos de error que miramos caso por caso: (1) falsas alarmas en sismos de M5,4 a M5,7 sin réplicas, varios mar adentro, donde el Mc real de
        detección sería más alto que el de la región y varias profundidades valen exactamente 10 km (un valor por defecto del catálogo); esta explicación es una{" "}
        <strong>hipótesis nuestra, no verificada</strong>. (2) Sismos chicos con más de 10 réplicas: quedaba sin comprobar si eran el comienzo de
        un sismo mayor; con la magnitud mayor de cada secuencia se comprobó que sí en los {m.atipicos.chicos_con_muchas_mayor_despues} casos del dataset (ver «Lo
        que encontramos»).
      </p>

      <h4>Los números de cada paso</h4>
      <ul className="razones">
        <li>
          <strong>Paso 1, el intervalo.</strong> En cada tramo de magnitud la varianza de las réplicas es entre {n(Math.min(...varMedia))} y{" "}
          {n(Math.max(...varMedia))} veces la media (en un conteo de Poisson sería 1): por eso no se predice el número exacto.
        </li>
        <li>
          <strong>Paso 2, de la logística a Poisson.</strong> Regresión logística con magnitud y profundidad: {n(comp["regresión logística"][0], 3)}; con
          las clases balanceadas, {n(comp["regresión logística (balanced)"][0], 3)}; Poisson con las mismas entradas, {n(comp["Poisson (mag + prof)"][0], 3)}.
        </li>
        <li>
          <strong>Paso 3, el sesgo por región.</strong> Réplicas reales sobre esperadas (validación, sin los sismos de M6,5 o más, que en una suma tapan todo
          lo demás): México {n(cociente.crudo.mexico_ca, 2)} y Filipinas {n(cociente.crudo.philippines, 2)} con la magnitud cruda;{" "}
          {n(cociente.mag_sobre_mc.mexico_ca, 2)} y {n(cociente.mag_sobre_mc.philippines, 2)} con la magnitud sobre el umbral. Los Andes siguen lejos (
          {n(cociente.mag_sobre_mc.andes, 2)}), y eso el Mc no lo explica. El f1 casi no cambia ({n(comp["Poisson (mag + prof)"][0], 3)} →{" "}
          {n(comp["Poisson (mag_sobre_mc + prof)"][0], 3)}).
        </li>
        <li>
          <strong>Paso 5, el empuje.</strong> Con empuje {n(modelo.empuje, 1)} el recall de «pocas» pasa de {n(empuje0[3], 2)} a {n(empujeElegido[3], 2)} y
          el de «ninguna» baja de {n(empuje0[2], 2)} a {n(empujeElegido[2], 2)}; el f1 queda en {n(empujeElegido[0], 3)}, a un desvío del mejor.
        </li>
        <li>
          <strong>Paso 6, otros cortes.</strong> Con más intervalos todos los modelos bajan, porque distinguir más clases es más difícil, pero Poisson queda
          arriba en los cinco esquemas. Nos quedamos con [0] [1–2] [3–10] [11+] porque juntar «1 réplica» con «10 réplicas» en un mismo
          intervalo sirve menos para decidir qué sismo vigilar.
        </li>
      </ul>

      <h4>En qué se apoya</h4>
      <p>
        Coeficientes en unidades reales: <strong>×{n(m.coeficientes.multiplicador_por_punto, 2)}</strong> las réplicas esperadas por cada punto de magnitud sobre el umbral (α de Utsu ≈{" "}
        {n(m.coeficientes.alfa_utsu, 2)}) y <strong>×{n(m.coeficientes.multiplicador_100km, 2)}</strong> por cada 100 km más de profundidad. La magnitud se conoce minutos después del sismo y el
        Mc es un umbral fijo de cada región: no hay fuga.
      </p>
      <p>
        Importancia por permutación (el gráfico está arriba): con el modelo ya entrenado, se desordenan los valores de una columna en el test y se
        mide cuánto baja el f1 macro; 20 repeticiones con semilla fija. La magnitud baja {n(perm.mainshock_mag.media, 3)} ±{" "}
        {n(perm.mainshock_mag.desvio, 3)}; la profundidad, {n(perm.mainshock_depth.media, 3)} ± {n(perm.mainshock_depth.desvio, 3)}; el umbral de la
        región, {n(perm.region_mc.media, 3)} ± {n(perm.region_mc.desvio, 3)}. Como la magnitud y el umbral entran juntos (mag − Mc), desordenar el
        umbral también mueve esa entrada.
      </p>
      <h4>Cómo llega el modelo a la página</h4>
      <p>
        Es una fórmula cerrada: <code>réplicas esperadas = exp(b₀ + b₁·z₁ + b₂·z₂)</code> con z estandarizadas, y las probabilidades salen de la distribución de Poisson en los cortes 0, 2 y 10.
        Los coeficientes viajan con la página. La API (FastAPI) y el navegador implementan la misma fórmula y se verificaron contra el modelo original (scikit-learn) en 6.992 casos: misma clase
        en el 100 % y probabilidades con diferencia menor a 1e-9.
      </p>
    </>
  );
}
