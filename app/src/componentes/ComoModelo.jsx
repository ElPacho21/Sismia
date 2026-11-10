import { fecha, n } from "../lib/formato.js";
import Tabla from "./Tabla.jsx";

// «Cómo lo sabemos» de El modelo: métrica, piso, validación, comparación, ajuste, test, errores y en qué se apoya.
const CLASES_CORTAS = ["ninguna (0)", "pocas (1–2)", "moderadas (3–10)", "muchas (11+)"];

export default function ComoModelo({ metricas, modelo }) {
  const m = metricas;
  const ajuste = m.ajuste;
  const comparacion = Object.entries(m.comparacion_validacion).sort((a, b) => b[1][0] - a[1][0]);
  const permutacion = Object.entries(m.importancia_permutacion).sort((a, b) => b[1].media - a[1].media);
  const nombrePermutacion = {
    mainshock_mag: "Magnitud del principal",
    mainshock_depth: "Profundidad",
    region_mc: "Umbral Mc de la región (forma parte de mag − Mc)",
  };
  const matriz = m.matriz_confusion_test;
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
        viejas entrenan y las {n(m.particion.test)} más nuevas son el test, que se usa una sola vez. Para elegir y ajustar, el entrenamiento se valida con{" "}
        <code>TimeSeriesSplit</code> de 5 folds: se entrena con un tramo y se valida con el siguiente.
      </p>
      <Tabla
        columnas={[
          { titulo: "Fold", ver: (f) => f.indice, alinear: "num" },
          { titulo: "Entrena hasta", ver: (f) => fecha(f.entrena_hasta), alinear: "num" },
          { titulo: "Valida desde", ver: (f) => fecha(f.valida_desde), alinear: "num" },
          { titulo: "Valida hasta", ver: (f) => fecha(f.valida_hasta), alinear: "num" },
          { titulo: "Filas entrenamiento", ver: (f) => n(f.filas_entrenamiento), alinear: "num" },
          { titulo: "Filas validación", ver: (f) => n(f.filas_validacion), alinear: "num" },
          { titulo: "f1 del modelo elegido", ver: (f) => n(f.f1, 3), alinear: "num" },
        ]}
        filas={ajuste.folds.map((f, i) => ({ ...f, indice: i + 1, f1: m.final.f1_por_fold[i] }))}
      />

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
        Los tres Poisson caen dentro de un desvío entre sí. Se eligió <strong>Poisson con mag_sobre_mc y profundidad</strong> porque es de los mejores, es el más
        simple (dos coeficientes y una fórmula cerrada) y se puede escribir dentro de la página. La binomial negativa terminó contestando siempre «ninguna»
        (la dispersión la dominan los megasismos de hasta 2.544 réplicas).
      </p>
      <p className="nota">
        La tabla es la del notebook de la Entrega 3. Al regenerarla acá, dos filas no se reproducen exacto: random forest balanceado (
        {n(m.comparacion_medida_en_build["random forest (balanced)"][0], 3)} contra {n(m.comparacion_validacion["random forest (balanced)"][0], 3)}) y gradient boosting
        balanceado ({n(m.comparacion_medida_en_build["gradient boosting (balanced)"][0], 3)} contra{" "}
        {n(m.comparacion_validacion["gradient boosting (balanced)"][0], 3)}). Ninguna es el modelo elegido; la causa probable es la versión de scikit-learn, pero no la
        verificamos. El resto, incluidos el piso y Poisson, coincide dentro de 0,001.
      </p>

      <h4>El ajuste del elegido</h4>
      <p>
        <strong>alpha</strong> (regularización), con empuje 0. Entre 0,001 y 1 el f1 casi no cambia (dentro del desvío): con dos coeficientes el modelo casi no
        necesita regularizar. Se eligió <strong>{modelo.alpha}</strong>; con 10 cae.
      </p>
      <Tabla
        columnas={[
          { titulo: "alpha", ver: (f) => f[0], alinear: "num" },
          { titulo: "f1 macro", ver: (f) => n(f[1][0], 3), alinear: "num" },
          { titulo: "Desvío", ver: (f) => n(f[1][1], 3), alinear: "num" },
        ]}
        filas={Object.entries(ajuste.alpha)}
        resaltar={(f) => Number(f[0]) === modelo.alpha}
      />
      <p>
        <strong>empuje</strong>: el modelo dice «hay réplicas» con más facilidad a costa de más falsas alarmas (divide cada probabilidad por lo común que es esa
        clase, elevado al empuje). Se prefiere avisar de más antes que perder un caso. Regla: el empuje más alto cuyo f1 macro esté a un desvío del mejor. Eligió{" "}
        <strong>{modelo.empuje}</strong>.
      </p>
      <Tabla
        columnas={[
          { titulo: "empuje", ver: (f) => f[0], alinear: "num" },
          { titulo: "f1 macro", ver: (f) => n(f[1][0], 3), alinear: "num" },
          { titulo: "Desvío", ver: (f) => n(f[1][1], 3), alinear: "num" },
          ...CLASES_CORTAS.map((c, i) => ({ titulo: `recall ${c}`, ver: (f) => n(f[1][2 + i], 3), alinear: "num" })),
        ]}
        filas={Object.entries(ajuste.trade_off_empuje)}
        resaltar={(f) => Number(f[0]) === modelo.empuje}
      />

      <h4>El resultado en el test y dónde se equivoca</h4>
      <p>
        Entrenado con todo el entrenamiento y evaluado <strong>una vez</strong> en el test: f1 macro <strong>{n(m.final.f1_test, 3)}</strong> contra {n(m.piso.f1_test, 3)}{" "}
        del piso (accuracy {n(m.final.accuracy_test, 3)} contra {n(m.piso.accuracy_test, 3)}: baja porque el modelo se anima a avisar). Está por encima del f1 de validación (
        {n(m.final.f1_validacion, 3)} ± {n(m.final.desvio_validacion, 3)}); lo atribuimos a que «muchas» tiene sólo {m.reporte_test["muchas (11+)"].support} casos en el test (dos o tres
        aciertos más mueven mucho su f1) y a que el modelo final se entrena con más datos que cada fold.
      </p>
      <Tabla
        leyenda="Reporte por clase, en el test"
        columnas={[
          { titulo: "Clase", ver: (f) => f[0] },
          { titulo: "Precisión", ver: (f) => n(f[1].precision, 3), alinear: "num" },
          { titulo: "Recall", ver: (f) => n(f[1].recall, 3), alinear: "num" },
          { titulo: "f1", ver: (f) => n(f[1].f1, 3), alinear: "num" },
          { titulo: "Casos", ver: (f) => n(f[1].support), alinear: "num" },
        ]}
        filas={Object.entries(m.reporte_test)}
      />
      <Tabla
        leyenda="Matriz de confusión en el test (filas: lo que pasó; columnas: lo que dijo el modelo)"
        columnas={[
          { titulo: "Real \\ Predicho", ver: (f) => f.nombre },
          ...CLASES_CORTAS.map((c, j) => ({ titulo: c, ver: (f) => n(f.valores[j]), alinear: "num" })),
        ]}
        filas={matriz.map((valores, i) => ({ nombre: CLASES_CORTAS[i], valores }))}
      />
      <p>
        De las {n(m.avisos_test.con_replicas)} secuencias del test que tuvieron réplicas, el modelo avisó en {n(m.avisos_test.avisados_pct, 1)} %. El costo: {n(m.avisos_test.falsas_alarmas)} falsas
        alarmas contra {n(m.avisos_test.avisos_correctos)} avisos correctos. <strong>Sirve para priorizar qué sismos vigilar, no para emitir alertas.</strong>
      </p>
      <Tabla
        leyenda="Acierto del intervalo según la magnitud, en el test"
        columnas={[
          { titulo: "Magnitud", ver: (f) => f[0] },
          { titulo: "Secuencias", ver: (f) => n(m.tramo_n_test[f[0]]), alinear: "num" },
          { titulo: "Acierta el intervalo", ver: (f) => `${n(f[1], 1)} %`, alinear: "num" },
        ]}
        filas={Object.entries(m.acierto_por_tramo_test)}
      />
      <p>
        Acierta más en los extremos (M4–5 casi siempre «ninguna»; M7 o más, «muchas») y menos en el medio, porque ahí las réplicas esperadas quedan cerca de los cortes de 2 y 10.
      </p>
      <p className="nota">
        Dos tipos de error que miramos caso por caso en el notebook, con explicaciones que son <strong>hipótesis nuestras, no verificadas</strong>: (1) falsas alarmas en sismos de M5,4 a M5,7 sin
        réplicas, varios mar adentro, donde el Mc real de detección sería más alto que el de la región y varias profundidades valen exactamente 10 km (un valor por defecto del catálogo);
        (2) sismos chicos con más de 10 réplicas, en zonas de enjambres (islas Nicobar y Andamán, islas Izu), donde no hay un principal claro.
      </p>

      <h4>En qué se apoya</h4>
      <p>
        Coeficientes en unidades reales: <strong>×{n(m.coeficientes.multiplicador_por_punto, 2)}</strong> las réplicas esperadas por cada punto de magnitud sobre el umbral (α de Utsu ≈{" "}
        {n(m.coeficientes.alfa_utsu, 2)}) y <strong>×{n(m.coeficientes.multiplicador_100km, 2)}</strong> por cada 100 km más de profundidad. La magnitud se conoce minutos después del sismo y el
        Mc es un umbral fijo de cada región: no hay fuga.
      </p>
      <Tabla
        leyenda="Importancia por permutación en el test: cuánto baja el f1 macro al desordenar la columna (20 repeticiones)"
        columnas={[
          { titulo: "Columna", ver: (f) => nombrePermutacion[f[0]] },
          { titulo: "Baja el f1 en", ver: (f) => n(f[1].media, 3), alinear: "num" },
          { titulo: "Desvío", ver: (f) => n(f[1].desvio, 3), alinear: "num" },
        ]}
        filas={permutacion}
      />
      <h4>Cómo llega el modelo a la página</h4>
      <p>
        Es una fórmula cerrada: <code>réplicas esperadas = exp(b₀ + b₁·z₁ + b₂·z₂)</code> con z estandarizadas, y las probabilidades salen de la distribución de Poisson en los cortes 0, 2 y 10.
        Los coeficientes están en <code>model.json</code>. La API (FastAPI) y el navegador implementan la misma fórmula y se verificaron contra el modelo del notebook en 6.992 casos: misma clase
        en el 100 % y probabilidades con diferencia menor a 1e-9.
      </p>
    </>
  );
}
