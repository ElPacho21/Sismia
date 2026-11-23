import { useEffect, useState } from "react";

// La grieta de fondo: una grieta gruesa, decorativa, que atraviesa el relato (el tallo) de arriba abajo y se cierra en
// punta en el borde de la copa. El relato sigue la grieta; donde termina, empieza la parte para explorar.
//
// Es un SVG detrás de todo el contenido (las placas de los gráficos quedan encima, como si la grieta pasara por debajo).
// El relleno es apenas distinto del fondo y lleva un labio de luz debajo: el texto que la cruza se sigue leyendo en los
// dos temas. La forma sale de una semilla, así que es la misma en cada visita; se recalcula cuando cambia el alto de la
// página (los gráficos y el globo lo cambian al cargar) o el ancho de la ventana.

const SEMILLA = 23;
const ANCHO_MAXIMO = 34; // px, en una pantalla de escritorio; en pantallas angostas se afina

// una grieta como polígono: su línea central, el ancho en cada punto y bordes ásperos a cada lado
function poligono(centro, anchos, azar) {
  const izq = [];
  const der = [];
  centro.forEach(([x, y], i) => {
    const [ax, ay] = centro[Math.max(0, i - 1)];
    const [bx, by] = centro[Math.min(centro.length - 1, i + 1)];
    let nx = -(by - ay);
    let ny = bx - ax;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const m = anchos[i] / 2;
    const r1 = m * (1 + Math.abs(azar()) * 0.7);
    const r2 = m * (1 + Math.abs(azar()) * 0.7);
    izq.push([x - nx * r1, y - ny * r1]);
    der.push([x + nx * r2, y + ny * r2]);
  });
  const ps = [...izq, ...der.reverse()];
  return "M" + ps.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";
}

// la grieta principal y sus secundarias, en un área de ancho w (desde x0) que termina en la punta yFin
export function trazarGrieta(x0, w, yFin) {
  let semilla = SEMILLA;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647 - 0.5;
  };
  const ancho = ANCHO_MAXIMO * Math.min(1, Math.max(0.45, w / 1376));
  const amplitud = Math.min(40, w * 0.03);

  // la principal: entra por arriba de la página, serpentea por el ancho y se cierra en la punta
  const centro = [];
  const anchos = [];
  let deriva = 0;
  for (let y = -20; y <= yFin; y += 16) {
    deriva = Math.max(-amplitud, Math.min(amplitud, deriva + azar() * 22));
    centro.push([x0 + w * (0.56 + 0.26 * Math.sin(y / 1150 + 1.1)) + deriva, y]);
    const cierre = Math.max(0, Math.min(1, (yFin - y) / 650));
    anchos.push(ancho * Math.pow(cierre, 0.8) * (0.7 + 0.3 * Math.sin(y / 260) + azar() * 0.25));
  }
  const formas = [poligono(centro, anchos, azar)];

  // las secundarias: salen de la principal en diagonal, más angostas, y se cierran en su propia punta
  [0.1, 0.19, 0.3, 0.41, 0.52, 0.63, 0.74, 0.86].forEach((f, k) => {
    const i = Math.floor(f * (centro.length - 1));
    const [xa, ya] = centro[i];
    const lado = k % 2 ? 1 : -1;
    const largo = (180 + Math.abs(azar()) * 520) * Math.min(1, w / 1376);
    const angulo = (0.35 + Math.abs(azar()) * 0.5) * lado;
    const c = [];
    const a = [];
    let dx = 0;
    const n = Math.max(4, Math.round(largo / 16));
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      dx += azar() * 10;
      c.push([xa + Math.sin(angulo) * largo * t + dx, ya + Math.cos(Math.abs(angulo)) * largo * t * 0.75]);
      a.push(anchos[i] * 0.5 * Math.pow(1 - t, 1.1));
    }
    formas.push(poligono(c, a, azar));
    // a veces, una rama de la rama
    if (k % 3 === 1) {
      const m = Math.floor(n * 0.45);
      const [x1, y1] = c[m];
      const c2 = [];
      const a2 = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        c2.push([x1 - lado * 140 * t * Math.min(1, w / 1376) + azar() * 8, y1 + 110 * t]);
        a2.push(a[m] * 0.6 * (1 - t));
      }
      formas.push(poligono(c2, a2, azar));
    }
  });
  return formas.join(" ");
}

// fin: el id de la sección donde termina la grieta (el borde de la copa)
export default function GrietaFondo({ fin = "explora" }) {
  const [forma, setForma] = useState(null);

  useEffect(() => {
    let cuadro = 0;
    const dibujar = () => {
      cuadro = 0;
      const copa = document.getElementById(fin);
      if (!copa) return;
      const ancho = document.documentElement.clientWidth;
      // en pantallas anchas el testigo ocupa la izquierda: la grieta se reparte por el resto
      const x0 = parseFloat(getComputedStyle(document.body).paddingLeft) || 0;
      const yFin = copa.getBoundingClientRect().top + window.scrollY - 40;
      const clave = `${ancho}|${Math.round(yFin)}`;
      setForma((f) => (f?.clave === clave ? f : { clave, ancho, alto: yFin + 40, d: trazarGrieta(x0, ancho - x0, yFin) }));
    };
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(dibujar);
    };
    const ojo = new ResizeObserver(pedir);
    ojo.observe(document.body);
    pedir();
    return () => {
      ojo.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [fin]);

  if (!forma) return null;
  return (
    <svg className="grieta-fondo" aria-hidden="true" width={forma.ancho} height={forma.alto} viewBox={`0 0 ${forma.ancho} ${forma.alto}`}>
      <path d={forma.d} className="grieta-labio" transform="translate(0 2.5)" />
      <path d={forma.d} className="grieta-hueco" />
    </svg>
  );
}
