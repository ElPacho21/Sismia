import { useEffect, useState } from "react";
import { cargarDatos } from "./lib/datos.js";
import { despertarApi } from "./lib/api.js";
import { n, pct } from "./lib/formato.js";
import { aplicarTema, temaInicial, TemaContexto } from "./lib/tema.js";
import Tallo, { Paso } from "./componentes/Tallo.jsx";
import Grafico from "./componentes/Grafico.jsx";
import ComoDatos from "./componentes/ComoDatos.jsx";
import ComoHallazgo from "./componentes/ComoHallazgo.jsx";
import ComoModelo from "./componentes/ComoModelo.jsx";
import Problema from "./componentes/Problema.jsx";
import GloboPuerta from "./componentes/GloboPuerta.jsx";
import ProbaModelo, { EJEMPLOS, usePrediccion } from "./componentes/ProbaModelo.jsx";
import Testigo from "./componentes/Testigo.jsx";
import GrietaFondo from "./componentes/GrietaFondo.jsx";


export default function App() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  // lo que comparten el globo y las barras de Explorá (filtros) y el caso cargado en «Probá el modelo»
  const [filtros, setFiltros] = useState(null);
  const [entrada, setEntrada] = useState(EJEMPLOS[0]);
  const [tema, setTema] = useState(temaInicial);
  const elegirTema = (t) => {
    aplicarTema(t);
    setTema(t);
  };

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

  if (error) return <p className="error centro">No se pudo cargar la aplicación: {error}</p>;
  if (!d || !filtros) return <p className="cargando centro">Cargando…</p>;

  const { textos, metricas, hipotesis, pasos, regiones, modelo, paleta } = d;
  const total = metricas.particion.entrenamiento + metricas.particion.test;
  const columnas = metricas.columnas;
  const totalColumnas = columnas.reduce((a, g) => a + g.n, 0);
  const [identifican, respuesta, fuga, constantes, probadas, usadas] = columnas.map((g) => g.n);
  const at = metricas.atipicos;
  const perm = metricas.importancia_permutacion;
  const comp = metricas.comparacion_validacion;
  const colProbadas = metricas.columnas_probadas;
  const sem = hipotesis.semaforo;
  const colRojas = sem.columnas.length - sem.usa_el_modelo.length;
  // de cada 100 secuencias de un grupo, cuántas caen en la clase i (0 = ninguna … 3 = muchas)
  const rep = (panel, etapa, grupo, i, decimales = 0) => {
    const v = sem.reparto.find((r) => r.panel === panel && r.etapa === etapa && r.grupo === grupo && r.clase === paleta.clases[i]).por_cien;
    return decimales ? v : Math.round(v);
  };
  // la mejor de las otras familias probadas con las mismas dos entradas (celda 57 del notebook)
  const [, otraMejorF1] = [
    "regresión logística (mag_sobre_mc)",
    "regresión logística balanced (mag_sobre_mc)",
    "random forest",
    "random forest (balanced)",
    "gradient boosting (balanced)",
  ]
    .map((k) => [k, comp[k][0]])
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <TemaContexto.Provider value={{ tema, claro: d.paleta.tema_claro }}>
      <Testigo
        tema={tema}
        alElegirTema={elegirTema}
        secciones={[
          { id: "proyecto", rotulo: "El proyecto", titulo: textos.pregunta },
          { id: "datos", rotulo: "1 · Los datos", titulo: textos.titulo_datos },
          { id: "encontramos", rotulo: "2 · Lo que encontramos", titulo: textos.titulo_hallazgo },
          { id: "modelo", rotulo: "3 · El modelo", titulo: textos.titulo_modelo },
          { id: "explora", rotulo: "Explorá", titulo: `Recorré las ${n(total)} secuencias y mirá qué dijo el modelo sobre cada una`, copa: true },
          { id: "proba", rotulo: "Probá el modelo", titulo: "Cargá un sismo nuevo y mirá cuántas réplicas espera el modelo", copa: true },
        ]}
      />

      <GrietaFondo fin="explora" />
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
                Casi todas las secuencias son grises: no dejaron ninguna réplica. Un modelo que contesta siempre «ninguna» acierta el{" "}
                {pct(metricas.piso.accuracy_test * 100, 0)} de las veces sin servir para nada: lo llamamos <strong>el piso</strong>, lo mínimo a superar.
                Por eso medimos con el <strong>f1 macro</strong>, que mira las cuatro clases por igual; el piso saca apenas {n(metricas.piso.f1_test, 2)}.
              </p>
            }
            extra={
              <>
                <Problema>
                  Empezamos sólo con los Andes y no alcanzaba: había apenas 41 sismos de más de M6, y el 93 % de las secuencias no tenía ninguna réplica.
                </Problema>
                <h3 className="subtitulo">Por eso sumamos cinco regiones del Cinturón de Fuego del Pacífico, donde ocurre la mayoría de los sismos grandes</h3>
                <Grafico
                  url="specs/cinturon.json"
                  descripcion="Mapa centrado en el Pacífico con el Cinturón de Fuego (trazado aproximado) y los rectángulos de las cinco regiones, con cuántas secuencias aporta cada una."
                />
                <div className="que-mirar">
                  <p>
                    Son zonas de subducción del <strong>Cinturón de Fuego del Pacífico</strong>, donde ocurre cerca del 81 % de los sismos más grandes
                    del planeta (USGS): así pasamos a {n(total)} secuencias. No usamos el planeta entero porque, con zonas grandes, el método unía sismos sin relación
                    (en los Andes aparecieron «secuencias» de 3.610 km). Procesando cada región por separado y con un tope de distancia entre réplica y
                    sismo, hoy la más extensa mide {n(metricas.extension.maxima_km)} km.
                  </p>
                </div>

                <h3 className="subtitulo">
                  De las {totalColumnas} columnas del dataset, el modelo usa {usadas}
                </h3>
                <Grafico
                  url="specs/columnas.json"
                  descripcion="Las columnas como recuadros, en tres filas: las del dataset, las que existen en el momento del sismo y las que usa el modelo. Lleno = sigue; vacío = ya salió, agrupadas por el motivo."
                />
                <div className="que-mirar">
                  <p>
                    El filtro es una pregunta: <em>¿esta columna existiría en el momento del sismo?</em> Las de <strong>fuga</strong> no, porque se saben
                    recién cuando la secuencia terminó (pasá el mouse por cada recuadro para ver qué columna es). De las {probadas + usadas} que quedan, el modelo
                    usa {usadas}. Una es el <strong>umbral</strong> (Mc): la magnitud desde la que cada región registra todos los sismos. Entra restado a la
                    magnitud, como <em>magnitud sobre el umbral</em>.
                  </p>
                </div>
                <Problema>
                  Al principio, el sismo principal de cada secuencia era el más grande, pero eso también es fuga: se sabe recién cuando la secuencia
                  termina, y en el momento nadie sabe si después viene uno mayor.
                </Problema>
                <div className="que-mirar">
                  <p>
                    Por eso el principal es el sismo que <strong>abre</strong> la secuencia, que es lo que se sabe en el momento. El costo: si después viene
                    uno más grande, sus réplicas se le cuentan al primero. Por ejemplo, el M7,3 del 9 de marzo de 2011 frente a Ōfunato (Japón) figura con
                    2.544 réplicas, pero casi todas son del M9,1 que vino dos días después.
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
            puente={
              <>
                Ya sabemos de dónde salen los datos, que casi ninguna secuencia deja réplicas y qué columnas existen en el momento del sismo. Ahora, la
                pregunta es cuáles de ellas se mueven con las réplicas.
              </>
            }
            spec="specs/hallazgo.json"
            descripcion="Réplicas medias según cuánto supera la magnitud al umbral de la región, con el eje vertical lineal y logarítmico."
            queMirar={
              <p>
                El eje horizontal es cuánto supera cada sismo el umbral de su región; cada punto es un tramo, y su tamaño, cuántas secuencias tiene. A
                la izquierda se ve la forma: casi plano hasta +2 y después se dispara. A la derecha, en escala logarítmica, la curva queda casi recta: cada
                tramo multiplica al anterior. Así se pasa de {n(textos.hallazgo_desde, 1)} réplicas de media en los sismos que apenas superan el umbral
                a {n(textos.hallazgo_hasta)} en los que lo superan por {textos.hallazgo_tramo_alto} puntos. Los puntos chicos son pocas secuencias, y los
                mueve algún megasismo. Por eso la cuenta la hace el modelo, secuencia por secuencia: <strong>cada punto de magnitud multiplica las
                réplicas esperadas por unas {n(metricas.coeficientes.multiplicador_por_punto, 1)} veces</strong>.
              </p>
            }
            extra={
              <>
                <h3 className="subtitulo">
                  Cuanto más grande el sismo, más réplicas; la profundidad sólo marca diferencia en los sismos grandes
                </h3>
                <Grafico
                  url="specs/movimientos.json"
                  descripcion="De cada 100 secuencias de cada grupo, en cuántas hubo más de 10 réplicas: por tamaño del sismo, y someros contra profundos con todos los sismos y sólo con los de M6 o más."
                />
                <div className="que-mirar">
                  <p>
                    Antes de medir escribimos qué esperábamos. <strong>H1</strong>: «las réplicas crecen con la magnitud». <strong>H3</strong>: «los sismos
                    someros dejan más réplicas que los profundos». Cada barra dice, de cada 100 secuencias del grupo, en cuántas hubo más de 10 réplicas. La
                    medición de cada hipótesis está en «Cómo lo sabemos».
                  </p>
                  <p>
                    <strong>H1 se sostuvo.</strong> De cada 100 secuencias con un principal de M4 a M5, prácticamente en ninguna ({n(rep("magnitud", "todas las secuencias", "M4–5", 3, 1), 1)});
                    de cada 100 con un principal de M7 o más, en {rep("magnitud", "todas las secuencias", "M7 o más", 3)}.
                  </p>
                  <p>
                    <strong>H3, a medias.</strong> Con todas las secuencias, someras y profundas casi no tienen réplicas. Entre las de un principal de M6 o
                    más sí se separan: {rep("profundidad", "sólo M6 o más", "someros", 3)} de cada 100 someras tienen más de 10 réplicas, contra{" "}
                    {rep("profundidad", "sólo M6 o más", "profundos", 3)} de cada 100 profundas. Por eso la profundidad entra al modelo junto con la magnitud.
                  </p>
                </div>

                <h3 className="subtitulo">Pero la magnitud sola no alcanza: hay casos que se salen de la regla</h3>
                <Grafico
                  url="specs/atipicos.json"
                  descripcion="Magnitud del sismo principal contra réplicas de cada secuencia, con los casos atípicos marcados y los más notables rotulados."
                />
                <div className="que-mirar">
                  <p>
                    <strong>H4 no se sostuvo</strong>: «con la magnitud alcanza para saber cuántas réplicas habrá». Entre los {n(hipotesis.h4.n)} sismos de
                    M6 o más, la relación es sólo moderada (Spearman {n(hipotesis.h4.spearman, 2)}), y sismos de magnitud parecida dejan desde{" "}
                    {n(hipotesis.h4.minimo)} hasta {n(hipotesis.h4.maximo)} réplicas.
                  </p>
                  <p>
                    Los <strong>triángulos</strong> son el costo de tomar como principal el sismo que abre la secuencia: secuencias en las que, después del principal, vino un sismo más grande: son el{" "}
                    {pct(at.pct_secuencias_mayor_despues, 1)} de las secuencias, pero suman el {pct(at.pct_replicas_mayor_despues, 0)} de las réplicas, porque
                    todas se le cuentan al principal. Los <strong>cuadrados</strong> son lo contrario: sismos de M7 o más casi sin réplicas;{" "}
                    {at.grandes_con_pocas_profundos_290} de los {at.grandes_con_pocas}, a más de 290 km de profundidad.
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
            puente={
              <>
                Ya sabemos que las réplicas se multiplican con la magnitud, que la profundidad marca diferencia en los sismos grandes y que hay casos que se salen de la regla.
                Con eso armamos el modelo. Estos son los pasos, en el orden en que los dimos: cada título dice la decisión que tomamos.
              </>
            }
            antes={
              <>
                <Paso
                  numero="1"
                  problema={
                    <>
                      Sismos de la misma magnitud dejan cantidades muy distintas. De los {hipotesis.m6_exactos.n} sismos de M6,0,{" "}
                      {hipotesis.m6_exactos.por_clase[0]} no dejaron ninguna réplica, {hipotesis.m6_exactos.por_clase[1]} dejaron 1 o 2,{" "}
                      {hipotesis.m6_exactos.por_clase[2]} entre 3 y 10, y {hipotesis.m6_exactos.por_clase[3]} más de 10.
                    </>
                  }
                  titulo="Predecimos un intervalo, no un número exacto"
                  spec="specs/intervalos.json"
                  descripcion="Réplicas de cada secuencia por tramo de magnitud, con la media de cada tramo."
                >
                  <p>
                    En vez del número exacto, predecimos un intervalo: ninguna (0), pocas (1–2), moderadas (3–10) o muchas (11+). En el gráfico, cada
                    tramo de magnitud tiene secuencias desde cero hasta cientos de réplicas.
                  </p>
                  <p className="nota">
                    Cada punto es una secuencia, pintada según su clase y desparramada a lo ancho para que no se tapen; la raya blanca es la media del tramo.
                  </p>
                </Paso>
                <Paso
                  numero="2"
                  titulo="Pasamos de la regresión logística a Poisson"
                  spec="specs/logistica_poisson.json"
                  descripcion="f1 macro en validación de la regresión logística, la logística con clases balanceadas y la regresión de Poisson, contra el piso."
                >
                  <p>
                    Con las mismas dos entradas (magnitud y profundidad), la regresión de Poisson le ganó a la logística. Poisson está pensada para contar:
                    primero estima cuántas réplicas espera cada sismo, y de ahí saca la probabilidad de cada intervalo.
                  </p>
                </Paso>
                <Paso
                  numero="3"
                  problema={
                    <>
                      El modelo se equivocaba según la región: en México <strong>subestimaba</strong> las réplicas (hubo{" "}
                      {n(metricas.real_sobre_esperadas.crudo.mexico_ca, 2)} veces las que esperaba) y en Filipinas las <strong>sobreestimaba</strong> (hubo{" "}
                      {n(metricas.real_sobre_esperadas.crudo.philippines, 2)}).
                    </>
                  }
                  titulo="Cambiamos la magnitud por la magnitud sobre el umbral de cada región"
                  spec="specs/sesgo_region.json"
                  descripcion="Réplicas reales sobre esperadas por región, con la magnitud cruda y con la magnitud sobre el umbral."
                >
                  <p>
                    México registra sismos desde M4,2 y Filipinas desde M4,7, así que México ve más réplicas. Restando el umbral de cada región, las dos
                    quedan mucho más cerca de lo esperado.
                  </p>
                </Paso>
                <Paso
                  numero="4"
                  titulo="No sumamos más columnas: las otras doce no mejoran el modelo"
                  spec="specs/columnas_probadas.json"
                  descripcion="f1 macro del modelo agregando cada columna, de a una, contra la banda de un desvío del modelo sin agregar nada."
                >
                  <p>
                    Las otras {colRojas} columnas casi no se mueven con las réplicas. Igual las probamos, agregándolas de a una y todas juntas: ninguna sale
                    de la banda de un desvío del modelo sin agregar nada ({n(colProbadas.base[0], 3)} ± {n(colProbadas.base[1], 3)}). <strong>El modelo
                    confirma el análisis exploratorio.</strong>
                  </p>
                  <p className="nota">
                    Un agregado sirve si su punto sale de la banda verde liquen por la derecha. Los cuadrados se probaron al armar el modelo; los círculos
                    huecos, después, con el dataset final.
                  </p>
                </Paso>
                <Paso
                  numero="5"
                  titulo="Nos quedamos con Poisson y le subimos el empuje"
                  spec="specs/empuje.json"
                  descripcion="Recall de cada clase y f1 macro en validación según el empuje."
                >
                  <p>
                    Ninguna otra familia superó a Poisson (la mejor, {n(otraMejorF1, 3)}), y la regularización casi no cambió el f1. Después subimos el{" "}
                    <strong>empuje</strong>, que es cuánto se anima el modelo a decir que hay réplicas: preferimos avisar de más antes que perder un sismo con
                    réplicas.
                  </p>
                </Paso>
                <Paso
                  numero="6"
                  titulo="Mantuvimos los cortes [0] [1–2] [3–10] [11+]"
                  spec="specs/cortes.json"
                  descripcion="Con cada una de cinco formas de cortar los intervalos, cuánto le gana Poisson a la logística balanceada en f1 macro."
                >
                  <p>
                    Los cortes los elegimos nosotros, así que probamos otras cuatro formas de cortar: en todas, Poisson le gana a la logística.
                  </p>
                  <p className="nota">
                    Con más intervalos el f1 baja para todos, porque la pregunta es más difícil: se comparan los dos puntos de cada fila, no las filas
                    entre sí.
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
                  Cada fila es un paso: en verde liquen lo que adoptamos, en rosa lo que dejamos; la línea punteada es el piso. Pasá el mouse por un punto
                  para ver qué pasó en ese paso.
                </p>
                <p>
                  <strong>¿Por qué este modelo, si varios dan parecido?</strong> Fueron tres decisiones distintas:
                </p>
                <ul className="razones">
                  <li>
                    <strong>Poisson y no otra familia:</strong> le gana a todo lo demás por más de un desvío, y es una fórmula que entra en la página.
                  </li>
                  <li>
                    <strong>Magnitud sobre el umbral y no la cruda:</strong> en f1 empatan; la elegimos porque corrige el sesgo entre regiones (paso 3).
                  </li>
                  <li>
                    <strong>Regularización y empuje:</strong> la regularización casi no cambia nada; el empuje sale de una regla (el más alto con el f1 a un
                    desvío del mejor).
                  </li>
                </ul>
                <p>
                  En el test, que no vio nunca, el elegido llega a {n(metricas.final.f1_test, 2)} contra {n(metricas.piso.f1_test, 2)} del piso. Sirve para
                  priorizar qué vigilar, no para emitir alertas: por cada {n(metricas.avisos_test.avisos_correctos)} avisos correctos hay{" "}
                  {n(metricas.avisos_test.falsas_alarmas)} falsas alarmas.
                </p>
              </>
            }
            extra={
              <>
                <h3 className="subtitulo">El modelo se apoya en la magnitud: sin ella, cae casi al nivel del piso</h3>
                <Grafico
                  url="specs/permutacion.json"
                  descripcion="f1 macro del modelo en el test con todas sus columnas y desordenando cada una, contra el piso."
                />
                <div className="que-mirar">
                  <p>
                    Desordenamos al azar una columna en los sismos del test, como si el modelo no la conociera, y medimos cuánto empeora. Sin la magnitud,
                    el f1 cae de {n(metricas.final.f1_test, 2)} a {n(metricas.final.f1_test - perm.mainshock_mag.media, 2)}: casi lo mismo que el piso (
                    {n(metricas.piso.f1_test, 2)}). Sin la profundidad o sin el umbral, apenas baja.
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
    </TemaContexto.Provider>
  );
}
