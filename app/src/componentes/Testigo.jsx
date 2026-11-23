import { useEffect, useRef, useState } from "react";

// La navegación de la página: un testigo de perforación. La página se lee como un corte de terreno, y el testigo es
// ese corte en miniatura: cada sección del relato (el tallo) es una capa con su color de horizonte y un alto
// proporcional a lo que mide en la página; las secciones para explorar (la copa) son capas huecas. Un marcador baja
// por las capas mientras se lee.
//
// En pantallas anchas es una columna fija a la izquierda: al pasar el mouse (o al entrar con el teclado) se despliega
// el corte con el título de cada sección. En pantallas angostas se acuesta: una franja de capas arriba, con la sección
// actual y un menú.
//
// secciones: [{ id, rotulo, titulo, copa }], en el orden de la página (cada id es el de su <section> o <header>).

// íconos del botón de tema: trazo de 1,8px con el color del texto, decorativos (el botón lleva su aria-label)
function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  );
}
function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

// el tema: oscuro (basalto) o claro (loess). El ícono muestra adónde se pasa: el sol en el tema oscuro, la luna en el claro
function BotonTema({ tema, alElegirTema }) {
  const otro = tema === "loess" ? "basalto" : "loess";
  const rotulo = otro === "loess" ? "Pasar al tema claro" : "Pasar al tema oscuro";
  return (
    <button type="button" className="tema" onClick={() => alElegirTema(otro)} aria-label={rotulo} title={rotulo}>
      {otro === "loess" ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}

// dónde empieza y cuánto mide cada sección, y qué parte de la página se leyó (lectura: la línea a un 35 % de la pantalla)
function useCorte(ids) {
  const [corte, setCorte] = useState({ alturas: ids.map(() => 1), leido: 0, actual: 0 });
  const clave = ids.join(" ");
  useEffect(() => {
    const lista = clave.split(" ");
    let medidas = null;
    let cuadro = 0;
    const medir = () => {
      const nodos = lista.map((id) => document.getElementById(id));
      if (nodos.some((n) => !n)) return null;
      const inicios = nodos.map((n) => n.getBoundingClientRect().top + window.scrollY);
      const total = document.documentElement.scrollHeight;
      const alturas = inicios.map((ini, i) => Math.max(1, (i + 1 < inicios.length ? inicios[i + 1] : total) - ini));
      return { inicios, total, alturas };
    };
    const leer = () => {
      cuadro = 0;
      medidas ??= medir();
      if (!medidas) return;
      const { inicios, total, alturas } = medidas;
      const alFinal = window.scrollY + window.innerHeight >= total - 2;
      const linea = window.scrollY + window.innerHeight * 0.35;
      let actual = 0;
      inicios.forEach((ini, i) => {
        if (linea >= ini) actual = i;
      });
      if (alFinal) actual = inicios.length - 1;
      const leido = alFinal ? 1 : Math.min(1, Math.max(0, (linea - inicios[0]) / (total - inicios[0])));
      setCorte((c) =>
        c.actual === actual && Math.abs(c.leido - leido) < 0.001 && c.alturas.join() === alturas.join() ? c : { alturas, leido, actual },
      );
    };
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(leer);
    };
    // los gráficos y el globo cambian el alto de la página al cargar: se vuelve a medir cada vez que cambia
    const ojo = new ResizeObserver(() => {
      medidas = medir();
      pedir();
    });
    ojo.observe(document.body);
    window.addEventListener("scroll", pedir, { passive: true });
    pedir();
    return () => {
      ojo.disconnect();
      window.removeEventListener("scroll", pedir);
      cancelAnimationFrame(cuadro);
    };
  }, [clave]);
  return corte;
}

// el fondo de cada capa: los horizontes de la columna estratigráfica en el tallo; la copa, hueca
const HORIZONTES = ["var(--horizonte-1)", "var(--horizonte-2)", "var(--horizonte-3)", "var(--horizonte-4)"];
const fondo = (s, i) => (s.copa ? undefined : HORIZONTES[Math.min(i, HORIZONTES.length - 1)]);

export default function Testigo({ secciones, tema, alElegirTema }) {
  const { alturas, leido, actual } = useCorte(secciones.map((s) => s.id));
  const [abierto, setAbierto] = useState(false); // el corte desplegado (pantallas anchas)
  const [menu, setMenu] = useState(false); // la lista de secciones (pantallas angostas)
  const nav = useRef(null);

  // al cambiar de sección, el rótulo aparece un momento junto al marcador (y se va para no tapar el contenido)
  const [avisa, setAvisa] = useState(false);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setAvisa(true);
    const t = setTimeout(() => setAvisa(false), 1800);
    return () => clearTimeout(t);
  }, [actual]);

  const cerrarSiSale = (e) => {
    if (!nav.current?.contains(e.relatedTarget)) setAbierto(false);
  };
  const esBordeCopa = (i) => secciones[i].copa && !secciones[i - 1]?.copa;
  const sec = secciones[actual];
  const suma = alturas.reduce((a, b) => a + b, 0);
  const tallo = alturas.filter((_, i) => !secciones[i].copa).reduce((a, b) => a + b, 0);
  // la grieta en miniatura va dentro del tramo del tallo: arranca arriba de la primera capa y termina justo al pie de
  // la última, antes del borde de la copa
  const grietaTestigo = "M" + [0, 0.15, 0.32, 0.5, 0.68, 0.85, 1].map((t, i) => `${i % 2 ? 62 : 38} ${(100 * t).toFixed(2)}`).join(" L");
  const capa = (s, i) => (
    <a
      key={s.id}
      href={`#${s.id}`}
      className={`capa${s.copa ? " hueca" : ""}`}
      style={{ flexGrow: alturas[i], background: fondo(s, i) }}
      aria-label={s.rotulo}
      aria-current={i === actual ? "location" : undefined}
    />
  );

  return (
    <>
      {/* pantallas anchas: la columna */}
      <nav
        ref={nav}
        className="testigo"
        aria-label="Secciones"
        data-abierto={abierto}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={cerrarSiSale}
        onFocus={() => setAbierto(true)}
        onBlur={cerrarSiSale}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
      >
        <a className="testigo-marca" href="#proyecto" translate="no">
          Sisimia
        </a>
        <div className="testigo-corte">
          {/* el tallo: sus capas y la grieta de fondo en miniatura, que termina al pie de la última */}
          <div className="testigo-tramo" style={{ flexGrow: tallo }}>
            {secciones.map((s, i) => !s.copa && capa(s, i))}
            <svg className="testigo-grieta" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={grietaTestigo} />
            </svg>
          </div>
          {/* la copa: capas huecas, sin grieta */}
          <div className="testigo-tramo testigo-tramo-copa" style={{ flexGrow: suma - tallo }}>
            {secciones.map((s, i) => s.copa && capa(s, i))}
          </div>
          <div className="testigo-marcador" style={{ top: `${(leido * 100).toFixed(2)}%` }} aria-hidden="true">
            <span className="testigo-rotulo" data-visible={avisa && !abierto}>
              {sec.rotulo}
            </span>
          </div>
        </div>
        <BotonTema tema={tema} alElegirTema={alElegirTema} />

        {/* el corte desplegado: repite las capas con su título (para el mouse; con el teclado se recorren las capas) */}
        <div className="testigo-panel" aria-hidden="true">
          <p className="testigo-leido">el corte, de arriba abajo · leíste {Math.round(leido * 100)} %</p>
          {secciones.map((s, i) => (
            <div key={s.id} className="testigo-panel-grupo">
              {esBordeCopa(i) && <p className="testigo-copa">para explorar</p>}
              <a href={`#${s.id}`} tabIndex={-1} className="testigo-fila" data-actual={i === actual}>
                <span className={`muestra${s.copa ? " hueca" : ""}`} style={{ background: fondo(s, i) }} />
                <span className="testigo-textos">
                  <span className="testigo-nombre">{s.rotulo}</span>
                  <span className="testigo-titulo">{s.titulo}</span>
                </span>
              </a>
            </div>
          ))}
        </div>
      </nav>

      {/* pantallas angostas: el testigo acostado arriba */}
      <header className="testigo-movil">
        <div className="testigo-franja" aria-hidden="true">
          {secciones.map((s, i) => (
            <span key={s.id} className={`capa${s.copa ? " hueca" : ""}`} style={{ flexGrow: alturas[i], background: fondo(s, i) }} />
          ))}
          <span className="testigo-franja-marcador" style={{ left: `${(leido * 100).toFixed(2)}%` }} />
        </div>
        <nav className="testigo-fila-movil" aria-label="Secciones">
          <a className="testigo-marca-movil" href="#proyecto" translate="no">
            Sisimia
          </a>
          <button type="button" className="testigo-actual" aria-expanded={menu} aria-controls="testigo-lista" onClick={() => setMenu((m) => !m)}>
            <span>{sec.rotulo}</span>
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          <BotonTema tema={tema} alElegirTema={alElegirTema} />
          {menu && (
            <ul id="testigo-lista" className="testigo-lista">
              {secciones.map((s, i) => (
                <li key={s.id}>
                  {esBordeCopa(i) && <p className="testigo-copa">para explorar</p>}
                  <a href={`#${s.id}`} className="testigo-fila" data-actual={i === actual} aria-current={i === actual ? "location" : undefined} onClick={() => setMenu(false)}>
                    <span className={`muestra${s.copa ? " hueca" : ""}`} style={{ background: fondo(s, i) }} />
                    <span className="testigo-nombre">{s.rotulo}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </header>
    </>
  );
}
