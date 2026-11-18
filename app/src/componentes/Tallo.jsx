import Grafico from "./Grafico.jsx";

// Una sección del tallo: un título que afirma (a la izquierda, fijo mientras se lee) y, a la derecha, la historia:
// opcionalmente los pasos que llevan hasta el gráfico principal (`antes`), el gráfico que prueba el título, unas líneas que
// dicen qué mirar, opcionalmente un segundo gráfico que sigue la historia (`extra`) y el desplegable «Cómo lo sabemos».
export default function Tallo({ id, numero, etiqueta, titulo, spec, descripcion, queMirar, antes, subtituloGrafico, extra, children }) {
  return (
    <section id={id} className="tallo">
      <div className="tallo-lado">
        <p className="etiqueta">
          {numero} · {etiqueta}
        </p>
        <h2>{titulo}</h2>
      </div>
      <div className="tallo-cuerpo">
        {antes}
        {subtituloGrafico && <h3 className="subtitulo">{subtituloGrafico}</h3>}
        <Grafico url={spec} descripcion={descripcion} />
        <div className="que-mirar">{queMirar}</div>
        {extra && <div className="extra">{extra}</div>}
        <details className="como">
          <summary>Cómo lo sabemos</summary>
          <div className="como-cuerpo">{children}</div>
        </details>
      </div>
    </section>
  );
}

// Un paso de la historia: un título numerado, lo que hicimos y por qué, y el gráfico que lo muestra.
export function Paso({ numero, titulo, spec, descripcion, children }) {
  return (
    <div className="paso">
      <h3 className="subtitulo">
        <span className="paso-numero">Paso {numero}</span>
        {titulo}
      </h3>
      <div className="que-mirar">{children}</div>
      <Grafico url={spec} descripcion={descripcion} />
    </div>
  );
}
