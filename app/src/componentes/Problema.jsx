// Un problema que apareció en el proyecto, en una línea, justo antes de la parte de la historia que lo resuelve:
// lo que sigue (el título, el gráfico, el texto) es la decisión que tomamos.
// Va en `error` (borde, ícono y etiqueta) para que se lea como un problema y no como un aviso cualquiera.
export default function Problema({ children }) {
  return (
    <p className="problema">
      <span className="problema-etiqueta">
        <svg
          className="problema-icono"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.5 21.5 20h-19Z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.25v.01" />
        </svg>
        Problema
      </span>
      <span>{children}</span>
    </p>
  );
}
