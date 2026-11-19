import { useEffect, useState } from "react";
import { cargarDatos } from "./lib/datos.js";
import { despertarApi } from "./lib/api.js";
import { n, pct } from "./lib/formato.js";
import Tallo, { Paso } from "./componentes/Tallo.jsx";
import Grafico from "./componentes/Grafico.jsx";
import ComoDatos from "./componentes/ComoDatos.jsx";
import ComoHallazgo from "./componentes/ComoHallazgo.jsx";
import ComoModelo from "./componentes/ComoModelo.jsx";
import GloboPuerta from "./componentes/GloboPuerta.jsx";
import ProbaModelo, { EJEMPLOS, usePrediccion } from "./componentes/ProbaModelo.jsx";

const NAV = [
  ["proyecto", "El proyecto"],
  ["datos", "Los datos"],
  ["encontramos", "Lo que encontramos"],
  ["modelo", "El modelo"],
  ["explora", "Explorá"],
  ["proba", "Probá el modelo"],
];

export default function App() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  // lo que comparten el globo y las barras de Explorá (filtros) y el caso cargado en «Probá el modelo»
  const [filtros, setFiltros] = useState(null);
  const [entrada, setEntrada] = useState(EJEMPLOS[0]);

  // la región elegida en Explorá pasa también al caso de «Probá el modelo»
  const regionFiltrada = filtros?.region;
  useEffect(() => {
    if (regionFiltrada && regionFiltrada !== "todas") setEntrada((e) => (e.region === regionFiltrada ? e : { ...e, region: regionFiltrada }));
  }, [regionFiltrada]);

  useEffect(() => {
    despertarApi(); // la función del servidor arranca en frío: se la despierta ya
    cargarDatos()
      .then((datos) => {
        const o = datos.textos.opciones;
        setFiltros({ region: o.region_inicial, magMin: o.mag_min_inicial, ver: o.ver[0], colorPor: o.color[0] });
        setD(datos);
      })
      .catch((e) => setError(e.message));
  }, []);

  const prediccion = usePrediccion(d?.modelo ?? null, entrada);

  // la barra marca la sección que se está leyendo
  const [actual, setActual] = useState("proyecto");
  const listoParaMirar = Boolean(d && filtros);
  useEffect(() => {
    if (!listoParaMirar) return;
    const ojo = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((x, y) => y.intersectionRatio - x.intersectionRatio)[0];
        if (visible) setActual(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.01, 0.5] },
    );
    for (const [id] of NAV) {
      const el = document.getElementById(id);
      if (el) ojo.observe(el);
    }
    return () => ojo.disconnect();
  }, [listoParaMirar]);

  if (error) return <p className="error centro">No se pudo cargar la aplicación: {error}</p>;
  if (!d || !filtros) return <p className="cargando centro">Cargando…</p>;

  const { textos, metricas, hipotesis, pasos, regiones, modelo, paleta } = d;
  const total = metricas.particion.entrenamiento + metricas.particion.test;
  const columnas = metricas.columnas;
  const totalColumnas = columnas.reduce((a, g) => a + g.n, 0);
  const [identifican, respuesta, fuga, constantes, probadas, usadas] = columnas.map((g) => g.n);
  const nuevas = metricas.columnas_nuevas;
  const previos2d = nuevas.n_prior_2d;
  const at = metricas.atipicos;
  const va = metricas.variables;
  const cociente = metricas.real_sobre_esperadas;
  const perm = metricas.importancia_permutacion;
  const empuje0 = metricas.ajuste.trade_off_empuje["0"];
  const empujeElegido = metricas.ajuste.trade_off_empuje[String(modelo.empuje)];
  const comp = metricas.comparacion_validacion;
  const tramos = Object.values(metricas.intervalos_por_tramo);
  const tramoMayor = metricas.intervalos_por_tramo["7 o más"];
  const varMedia = tramos.map((t) => t.var_media);
  const colProbadas = metricas.columnas_probadas;
  // la mejor de las otras familias probadas con las mismas dos entradas (celda 57 del notebook)
  const [otraMejor, otraMejorF1] = [
    "regresión logística (mag_sobre_mc)",
    "regresión logística balanced (mag_sobre_mc)",
    "random forest",
    "random forest (balanced)",
    "gradient boosting (balanced)",
  ]
    .map((k) => [k, comp[k][0]])
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <nav className="barra" aria-label="Secciones">
        <a className="marca" href="#proyecto" translate="no">
          Sisimia
        </a>
        {NAV.map(([id, nombre]) => (
          <a key={id} href={`#${id}`} aria-current={actual === id ? "true" : undefined}>
            {nombre}
          </a>
        ))}
      </nav>

      <main>
        {/* la pregunta es lo más grande de la portada; la respuesta y el título del proyecto van en chico */}
        <header id="proyecto" className="portada">
          <p className="etiqueta">El proyecto</p>
          <h1 className="pregunta">{textos.pregunta}</h1>
          <p className="respuesta">{textos.oracion}</p>
          <p className="aclaracion">{textos.aclaracion}</p>
          <ul className="numeros">
            {textos.numeros.map((x) => (
              <li key={x.valor}>
                <span className="valor">{x.valor}</span>
                <span className="texto">{x.texto}</span>
              </li>
            ))}
          </ul>
          <p className="nota">
            Proyecto integrador de Ciencia de Datos (UTN FRM). {n(total)} secuencias sísmicas de cinco regiones de subducción, 2003–2025.
          </p>
        </header>

        <div className="tallo-grupo">
          <Tallo
            id="datos"
            numero="1"
            etiqueta="Los datos"
            titulo={textos.titulo_datos}
            spec="specs/datos.json"
            descripcion="Barras con la cantidad de secuencias en cada intervalo de réplicas."
            queMirar={
              <p>
                Mirá la barra gris: casi todo el dataset son secuencias sin ninguna réplica. Por eso un modelo que contesta siempre «ninguna» acierta el{" "}
                {pct(metricas.piso.accuracy_test * 100, 0)} de las veces y no sirve para nada, y por eso la métrica tiene que mirar las cuatro clases por igual.
              </p>
            }
            extra={
              <>
                <h3 className="subtitulo">
                  De las {totalColumnas} columnas del dataset, el modelo usa {usadas}
                </h3>
                <Grafico url="specs/columnas.json" descripcion="Un cuadrado por columna del dataset, en filas según por qué entra o no al modelo." />
                <div className="que-mirar">
                  <p>
                    Cada cuadrado es una columna; pasá el mouse para ver cuál es y por qué está en esa fila. Las {identifican + respuesta + fuga + constantes} de
                    arriba no pueden entrar: identifican la secuencia, son la respuesta, son <strong>fuga</strong> ({fuga}: se saben recién cuando la secuencia
                    terminó) o valen siempre lo mismo. Quedan {probadas + usadas} que existen en el momento del sismo. Nos quedamos con {usadas}: la magnitud y el
                    umbral de detección de la región, que entran juntos como <em>magnitud sobre el umbral</em>, y la profundidad. Las otras {probadas} las
                    probamos agregándolas al modelo de a una, y ninguna lo mejora (paso 4 de «El modelo»).
                  </p>
                  <p>
                    <strong>Por qué cinco regiones y no el mundo entero.</strong> Elegimos cinco zonas de subducción con mucha actividad sísmica. El método que
                    separa las réplicas necesita una zona donde se detecte a partir de una magnitud parecida: con el planeta entero mezcla regiones que detectan
                    desde magnitudes muy distintas y termina uniendo sismos sin relación en grupos de miles de kilómetros. El detalle, en «Cómo lo sabemos».
                  </p>
                </div>
              </>
            }
          >
            <ComoDatos pasos={pasos} metricas={metricas} regiones={regiones} />
          </Tallo>

          <Tallo
            id="encontramos"
            numero="2"
            etiqueta="Lo que encontramos"
            titulo={textos.titulo_hallazgo}
            spec="specs/hallazgo.json"
            descripcion="Réplicas medias según cuánto supera la magnitud al umbral de la región, con el eje vertical lineal y logarítmico."
            queMirar={
              <p>
                Los dos paneles muestran los mismos puntos: cada uno es un tramo de magnitud; su tamaño, cuántas secuencias tiene, y su color, la
                clase en la que cae el promedio redondeado (en promedio, un sismo de ese tramo deja tantas réplicas). Con el eje lineal se ve la forma
                del crecimiento: casi plano hasta +2 y después se dispara. Con el logarítmico, los puntos quedan casi sobre una recta: cada tramo multiplica al
                anterior por un factor parecido, que es lo que significa crecer en forma exponencial. Los puntos chicos de la derecha son pocas secuencias: ahí el
                promedio lo mueven uno o dos megasismos.
              </p>
            }
            extra={
              <>
                <h3 className="subtitulo">Pero la magnitud sola no alcanza: hay casos que se salen de la regla</h3>
                <Grafico
                  url="specs/atipicos.json"
                  descripcion="Magnitud del sismo principal contra réplicas de cada secuencia, con los casos atípicos marcados y los más notables rotulados."
                />
                <div className="que-mirar">
                  <p>
                    Cada punto es una secuencia, pintada según su clase de réplicas; la forma marca el grupo. Los <strong>triángulos</strong> son las {n(at.secuencias_mayor_despues)} secuencias en las que, después del
                    principal, vino un sismo más grande: son el {pct(at.pct_secuencias_mayor_despues, 1)} de las secuencias, pero suman el{" "}
                    {pct(at.pct_replicas_mayor_despues, 0)} de todas las réplicas. Como el principal es el sismo que abre la secuencia, todas esas réplicas se le
                    cuentan a él. Por eso hay principales de M4 con decenas de réplicas: los {at.chicos_con_muchas} que superan el umbral de su región por menos de
                    medio punto y tienen más de 10 réplicas son todos de este grupo.
                  </p>
                  <p>
                    Los <strong>cuadrados</strong> son el caso opuesto: los {at.grandes_con_pocas} sismos de M7 o más con 2 réplicas o menos;{" "}
                    {at.grandes_con_pocas_profundos_290} de ellos a más de 290 km de profundidad. Entre los {n(hipotesis.h4.n)} sismos de M6 o más hay de{" "}
                    {hipotesis.h4.minimo} a {n(hipotesis.h4.maximo)} réplicas.
                  </p>
                </div>
              </>
            }
          >
            <ComoHallazgo hipotesis={hipotesis} metricas={metricas} />
          </Tallo>

          <Tallo
            id="modelo"
            numero="3"
            etiqueta="El modelo"
            titulo={textos.titulo_modelo}
            antes={
              <>
                <Paso
                  numero="1"
                  titulo="La respuesta: un intervalo, no un número exacto"
                  spec="specs/intervalos.json"
                  descripcion="Réplicas de cada secuencia por tramo de magnitud, con la media de cada tramo."
                >
                  <p>
                    Antes de elegir un modelo nos preguntamos si se podía predecir el número exacto de réplicas. No: sismos de magnitud parecida dejan cantidades
                    muy distintas. Entre los de M7 o más hay de {tramoMayor.minimo} a {n(tramoMayor.maximo)} réplicas, y en cada tramo la varianza es entre{" "}
                    {n(Math.min(...varMedia))} y {n(Math.max(...varMedia))} veces la media (en un conteo de Poisson sería 1). Por eso la respuesta pasó a ser un
                    intervalo: ninguna (0), pocas (1–2), moderadas (3–10) o muchas (11+). Como el 88 % es «ninguna», medimos con el f1 macro, y el número a superar
                    es el piso: contestar siempre «ninguna» da {n(metricas.piso.f1_validacion, 3)}.
                  </p>
                  <p className="nota">
                    Cada punto es una secuencia, pintada según su clase y desparramada a lo ancho para que no se tapen; la raya blanca es la media del tramo.
                  </p>
                </Paso>
                <Paso
                  numero="2"
                  titulo="De la regresión logística a Poisson"
                  spec="specs/ejemplo_poisson.json"
                  descripcion="Probabilidad de cada intervalo que da la primera regresión de Poisson para tres sismos inventados a 30 km."
                >
                  <p>
                    Cada modelo se entrena y se valida en 5 tramos de tiempo del entrenamiento (2003 a {metricas.particion.entrena_hasta.slice(0, 4)}); el test,
                    de {metricas.particion.test_desde.slice(0, 4)} a {metricas.particion.test_hasta.slice(0, 4)}, se guarda para el final. La primera prueba fue una
                    regresión logística con magnitud y profundidad: {n(comp["regresión logística"][0], 3)} contra {n(metricas.piso.f1_validacion, 3)} del piso
                    (balanceando las clases bajó a {n(comp["regresión logística (balanced)"][0], 3)}). Después, una regresión de Poisson, pensada para conteos:
                    estima cuántas réplicas espera y, con la distribución de Poisson, saca la probabilidad de cada intervalo. Subió a{" "}
                    {n(comp["Poisson (mag + prof)"][0], 3)}. El gráfico muestra qué contesta esa primera versión para tres sismos inventados.
                  </p>
                </Paso>
                <Paso
                  numero="3"
                  titulo="El error tenía un patrón: la región"
                  spec="specs/sesgo_region.json"
                  descripcion="Réplicas reales sobre esperadas por región, con la magnitud cruda y con la magnitud sobre el umbral."
                >
                  <p>
                    Antes de seguir buscamos si el error tenía un patrón. Comparamos, región por región, las réplicas reales con las que esperaba el modelo (en
                    validación y sin los sismos de M6,5 o más, que en una suma tapan todo lo demás). México tenía más de las esperadas (
                    {n(cociente.crudo.mexico_ca, 2)}) y Filipinas menos ({n(cociente.crudo.philippines, 2)}). México registra desde M4,2 y Filipinas desde M4,7: para
                    la misma magnitud, en México se ven más réplicas. Por eso cambiamos la magnitud por la <strong>magnitud sobre el umbral de la región</strong>{" "}
                    (mag − Mc). El f1 casi no cambió ({n(comp["Poisson (mag + prof)"][0], 3)} → {n(comp["Poisson (mag_sobre_mc + prof)"][0], 3)}), pero México y
                    Filipinas quedaron mucho más cerca ({n(cociente.mag_sobre_mc.mexico_ca, 2)} y {n(cociente.mag_sobre_mc.philippines, 2)}). Los Andes siguen
                    lejos ({n(cociente.mag_sobre_mc.andes, 2)}), y eso el Mc no lo explica.
                  </p>
                </Paso>
                <Paso
                  numero="4"
                  titulo="Más columnas, probadas de a una"
                  spec="specs/columnas_probadas.json"
                  descripcion="f1 macro del modelo agregando cada columna, de a una, contra la banda de un desvío del modelo sin agregar nada."
                >
                  <p>
                    Con la pista de los Andes probamos agregar la región (una columna por región) y los sismos de los 30 días previos. Ninguna mejoró por más que
                    el desvío: con la región, {n(colProbadas.region[0], 3)} ± {n(colProbadas.region[1], 3)}, igual que sin ella; con los sismos previos,{" "}
                    {n(colProbadas.previos[0], 3)} ± {n(colProbadas.previos[1], 3)}, que se superpone con {n(colProbadas.base[0], 3)} ± {n(colProbadas.base[1], 3)}.
                  </p>
                  <p>
                    Las otras diez columnas que existen en el momento del sismo no las habíamos probado: ocho no estaban en el dataset con el que empezamos, y la
                    latitud y la longitud las habíamos descartado al explorar los datos. Las probamos después, con el dataset final y el mismo método, y tampoco:
                    ninguna sale de la banda de un desvío, ni sola ni todas juntas. La única
                    con algo de información propia es la cantidad de sismos en los 2 días previos: entre los sismos de M5–6, dejan réplicas el{" "}
                    {pct(previos2d.con_replicas_pct["5–6"]["0"], 1)} de los que no tuvieron actividad previa y el {pct(previos2d.con_replicas_pct["5–6"]["1–4"], 1)}{" "}
                    de los que tuvieron de 1 a 4 sismos. Pero sólo el {pct(previos2d.pct_con_previos, 0)} de las secuencias tuvo actividad previa, y el f1 casi no se
                    mueve ({n(nuevas.celda54.columnas.n_prior_2d.f1, 3)}).
                  </p>
                  <p className="nota">
                    Un agregado sirve si su punto sale de la banda azul verdosa por la derecha. Los cuadrados se probaron al armar el modelo; los círculos
                    huecos, después.
                  </p>
                </Paso>
                <Paso
                  numero="5"
                  titulo="Otras familias, la regularización y el empuje"
                  spec="specs/empuje.json"
                  descripcion="Recall de cada clase y f1 macro en validación según el empuje."
                >
                  <p>
                    Con las mismas dos entradas probamos otras familias: la mejor, {otraMejor}, llegó a {n(otraMejorF1, 3)}, por debajo de Poisson, y la binomial
                    negativa terminó contestando siempre «ninguna». Con Poisson ajustamos la regularización (alpha {n(modelo.alpha, 3)}:{" "}
                    {n(metricas.ajuste.alpha[String(modelo.alpha)][0], 3)}) y después el <strong>empuje</strong>, que es cuánto se anima el modelo a decir que hay
                    réplicas. Preferimos avisar de más antes que perder un caso: con empuje {n(modelo.empuje, 1)} el recall de «pocas» pasa de {n(empuje0[3], 2)} a{" "}
                    {n(empujeElegido[3], 2)} y el de «ninguna» baja de {n(empuje0[2], 2)} a {n(empujeElegido[2], 2)}. Elegimos el empuje más alto con el f1 a un
                    desvío del mejor ({n(empujeElegido[0], 3)}).
                  </p>
                </Paso>
                <Paso
                  numero="6"
                  titulo="¿Y si cortábamos los intervalos en otro lado?"
                  spec="specs/cortes.json"
                  descripcion="f1 macro del piso, la logística balanceada y Poisson con cinco esquemas de cortes."
                >
                  <p>
                    Los cortes 0 · 1–2 · 3–10 · 11+ los elegimos nosotros, así que probamos otros cuatro con el piso, la logística balanceada y Poisson. Con más
                    intervalos todos bajan, porque distinguir más clases es más difícil, pero Poisson queda arriba en los cinco esquemas: elegirlo no depende de
                    dónde cortamos.
                  </p>
                </Paso>
              </>
            }
            subtituloGrafico="El camino completo: todos los modelos, en el orden en que los probamos"
            spec="specs/evolucion.json"
            descripcion="Cada paso del modelado, en orden, con su f1 macro en validación: lo adoptado unido por una línea y lo descartado en rosa."
            queMirar={
              <>
                <p>
                  Cada fila es un paso, en el orden en que lo probamos. Lo que adoptamos va en azul verdoso, unido por la línea; lo que probamos y dejamos, en rosa y
                  hueco. La barra es el desvío entre los 5 folds de validación y la línea punteada, el piso. Pasá el mouse por un punto para ver qué pasó en ese paso.
                </p>
                <p>
                  <strong>¿Por qué este modelo, si varios dan parecido?</strong> Fueron tres decisiones distintas. <em>Poisson y no otra familia:</em> los Poisson le
                  ganan a todo lo demás por más de un desvío ({n(comp["Poisson (mag_sobre_mc + prof)"][0], 3)} contra {n(otraMejorF1, 3)} de la mejor de las otras
                  familias), y además son una fórmula que se puede escribir dentro de la página. <em>Magnitud sobre el umbral y no magnitud cruda:</em> en f1
                  empatan ({n(comp["Poisson (mag_sobre_mc + prof)"][0], 3)} contra {n(comp["Poisson (mag + prof)"][0], 3)}); la elegimos porque corrige el sesgo
                  entre regiones (paso 3), no por el f1. <em>Regularización y empuje:</em> la regularización casi no importa (entre alpha 0,001 y 1 el f1 queda
                  dentro del desvío; nos quedamos con el promedio más alto), y el empuje sale de una regla: el más alto con el f1 a un desvío del mejor, porque
                  preferimos avisar de más antes que perder un sismo con réplicas.
                </p>
                <p>
                  En el test, que no vio nunca, el elegido llega a {n(metricas.final.f1_test, 2)} contra {n(metricas.piso.f1_test, 2)} del piso. Sirve para
                  priorizar qué vigilar, no para emitir alertas: por cada {n(metricas.avisos_test.avisos_correctos)} avisos correctos hay{" "}
                  {n(metricas.avisos_test.falsas_alarmas)} falsas alarmas.
                </p>
              </>
            }
            extra={
              <>
                <h3 className="subtitulo">Las dos variables: la magnitud cambia la respuesta mucho más que la profundidad</h3>
                <Grafico
                  url="specs/variables.json"
                  descripcion="Lo que contesta el modelo para cada combinación de magnitud sobre el umbral y profundidad, con los sismos de entrenamiento encima."
                />
                <div className="que-mirar">
                  <p>
                    El fondo es lo que contesta el modelo para cada combinación de magnitud sobre el umbral (horizontal) y profundidad (vertical, hacia abajo como en
                    la Tierra). Los círculos son los {n(metricas.particion.entrenamiento)} sismos de entrenamiento. A la profundidad de la mayoría, recorrer la
                    magnitud cruza las cuatro respuestas.
                  </p>
                  <p>
                    La profundidad también corre los cortes (100 km más profundo equivale a {n(va.puntos_por_100km, 2)} puntos menos de magnitud), pero la mitad de los
                    sismos está entre {n(va.prof_p25)} y {n(va.prof_p75)} km, y en ese rango los cortes se corren apenas {n(va.corrimiento_entre_cuartiles, 2)} puntos.
                    Lo mismo da la importancia por permutación: si se desordena la profundidad, el f1 del test baja {n(perm.mainshock_depth.media, 3)}; si se
                    desordena la magnitud, baja {n(perm.mainshock_mag.media, 3)}.
                  </p>
                </div>
              </>
            }
          >
            <ComoModelo metricas={metricas} modelo={modelo} />
          </Tallo>
        </div>

        <GloboPuerta d={d} filtros={filtros} setFiltros={setFiltros} />
        <ProbaModelo modelo={modelo} paleta={paleta} entrada={entrada} setEntrada={setEntrada} prediccion={prediccion} />
      </main>

      <footer className="pie">
        Sisimia · datos: USGS · modelo: regresión de Poisson por intervalos · código: pipeline, análisis y modelo en el repositorio.
      </footer>
    </>
  );
}
