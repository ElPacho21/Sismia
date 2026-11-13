import { lazy, Suspense, useEffect, useRef, useState } from "react";

// El globo pesa (three y los continentes): no se descarga hasta que el usuario está por llegar a esta sección.
const Globo = lazy(() => import("./Globo.jsx"));

export default function GloboPuerta(props) {
  const marco = useRef(null);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const ojo = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setCerca(true);
          ojo.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    ojo.observe(marco.current);
    return () => ojo.disconnect();
  }, []);

  return (
    <section id="globo" className="copa" ref={marco}>
      <p className="etiqueta">Copa · Globo</p>
      <h2>Los mismos datos, en el globo: elegí una región o animá una secuencia</h2>
      <p className="nota globo-intro">
        Es una vista extra. Cada efecto codifica un dato: el tamaño es la magnitud, el color es la clase, los anillos marcan los sismos M7 o más y, al animar una secuencia, el anillo
        de cada evento nace cuando le toca.
      </p>
      {cerca ? (
        <Suspense fallback={<p className="globo-cargando-fuera">Cargando el globo…</p>}>
          <Globo {...props} />
        </Suspense>
      ) : (
        <div className="globo-reserva" />
      )}
    </section>
  );
}
