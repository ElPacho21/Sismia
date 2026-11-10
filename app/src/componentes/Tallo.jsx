import Grafico from "./Grafico.jsx";

// Una sección del tallo: un título que afirma, el gráfico que lo prueba,
// unas líneas que dicen qué mirar y el desplegable «Cómo lo sabemos» (cerrado por defecto).
export default function Tallo({ id, numero, etiqueta, titulo, spec, descripcion, queMirar, children }) {
  return (
    <section id={id} className="tallo">
      <p className="etiqueta">
        {numero} · {etiqueta}
      </p>
      <h2>{titulo}</h2>
      <Grafico url={spec} descripcion={descripcion} />
      <div className="que-mirar">{queMirar}</div>
      <details className="como">
        <summary>Cómo lo sabemos</summary>
        <div className="como-cuerpo">{children}</div>
      </details>
    </section>
  );
}
