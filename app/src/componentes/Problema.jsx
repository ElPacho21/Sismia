// Un problema que apareció en el proyecto, en una línea, justo antes de la parte de la historia que lo resuelve:
// lo que sigue (el título, el gráfico, el texto) es la decisión que tomamos.
export default function Problema({ children }) {
  return (
    <p className="problema">
      <span className="problema-etiqueta">Problema</span>
      <span>{children}</span>
    </p>
  );
}
