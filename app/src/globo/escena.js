// La escena 3D del globo, con three (sin React: el componente sólo la crea, le pasa datos y la destruye).
//
// Qué se dibuja y qué codifica cada cosa:
//   * un punto por secuencia sísmica (21.292)  -> tamaño = magnitud, color = clase (real o la que dijo el modelo)
//   * rectángulos de las cinco regiones         -> dónde se aplica cada Mc
//   * anillos que laten en los sismos M7+       -> sólo para llamar la atención sobre los más grandes
//   * una secuencia animada                      -> cada evento aparece en su momento (reloj logarítmico);
//                                                  su anillo se expande una vez; color = clase real de la secuencia
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { centroRegion, latLonAVec3, regionDe, suavizar, tiempoLog, vec3ALatLon } from "./geo.js";

// Los colores de la paleta ya están en sRGB: se usan tal cual, sin conversión de espacio de color.
THREE.ColorManagement.enabled = false;

const RADIO_PUNTOS = 1.006;
const FOV = 40;
const DIST_MIN = 1.03; // casi pegado a la superficie, para separar los eventos de una secuencia
const DIST_REF = 3.1; // distancia a la que los tamaños de los puntos están pensados
const DIST_MAX = 6;

export function webglDisponible() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- shaders
const VERT_PUNTOS = `
  attribute float aTam; attribute vec3 aColor; attribute float aVis;
  uniform float uEscala; uniform float uDim; uniform float uK;
  varying vec3 vC; varying float vA;
  void main() {
    vC = aColor; vA = aVis * uDim;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aVis < 0.01 ? 0.0 : max(2.0 * aTam * uK * uEscala / (-mv.z), 2.2);
  }`;
const FRAG_PUNTOS = `
  varying vec3 vC; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vC, vA * smoothstep(1.0, 0.7, d) * 0.92);
  }`;

// Eventos con anillo. uModo 0: secuencia animada (el anillo nace cuando uS pasa por aS).
// uModo 1: anillos ambiente que laten solos en los sismos grandes.
const VERT_EVENTOS = `
  attribute float aMag; attribute float aS; attribute float aFase; attribute vec3 aColor; attribute float aVis;
  uniform float uEscala; uniform float uS; uniform float uTime; uniform float uModo; uniform float uK;
  varying vec3 vC; varying float vNucleo; varying float vAnillo; varying float vA;
  void main() {
    // en la secuencia la cámara está cerca: núcleos y anillos más chicos para que los eventos no se fundan en una mancha
    float kNucleo = uModo < 0.5 ? 0.75 : 1.0;
    float kAnillo = uModo < 0.5 ? 0.9 : 1.0;
    float rNucleo = uK * kNucleo * (0.0045 + 0.0035 * max(aMag - 4.0, 0.0));
    float rMax = uK * kAnillo * (0.014 + 0.012 * max(aMag - 5.0, 0.0));
    float anillo = -1.0; float nucleo = 1.0;
    if (uModo < 0.5) {
      float edad = uS - aS;
      if (edad < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      if (edad < 0.4) anillo = edad / 0.4;
    } else {
      float ciclo = mod(uTime * 0.22 + aFase * 3.0, 3.0);
      if (ciclo < 1.0) anillo = ciclo;
      nucleo = 0.0;
    }
    float rVis = anillo >= 0.0 ? rMax : rNucleo;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(2.0 * rVis * uEscala / (-mv.z), 3.0);
    vNucleo = nucleo * (rNucleo / rVis); vAnillo = anillo; vC = aColor; vA = aVis;
    if (aVis < 0.01 || (uModo > 0.5 && anillo < 0.0)) gl_PointSize = 0.0;
  }`;
const FRAG_EVENTOS = `
  varying vec3 vC; varying float vNucleo; varying float vAnillo; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = 0.0;
    if (vNucleo > 0.0 && d < vNucleo) a = 0.95;
    if (vAnillo >= 0.0) {
      float rr = mix(vNucleo, 0.94, vAnillo);
      a = max(a, smoothstep(0.07, 0.0, abs(d - rr)) * (1.0 - vAnillo) * 0.9);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(vC, a * vA);
  }`;
const VERT_ATMOSFERA = `
  varying vec3 vN;
  void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_ATMOSFERA = `
  varying vec3 vN;
  void main() { float i = pow(0.66 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.25, 0.55, 0.95, 1.0) * max(i, 0.0); }`;

// generador pseudoaleatorio con semilla: las estrellas y las fases de los anillos son siempre las mismas
function azar(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class EscenaGlobo {
  constructor(contenedor, o) {
    this.contenedor = contenedor;
    this.datos = o.datos;
    this.regiones = o.regiones;
    this.colores = o.colores.map((c) => new THREE.Color(c));
    this.reducirMovimiento = o.reducirMovimiento;
    this.alHover = o.alHover;
    this.alClickPunto = o.alClickPunto;
    this.alClickRegion = o.alClickRegion;
    this.filtros = { region: "todas", magMin: 0, soloTest: true, colorPor: "real" };
    this.dim = 1;
    this.vuelo = null;
    this.activo = true;
    this.tiempo = 0;
    this.hoverIdx = -1;

    const { clientWidth: w, clientHeight: h } = contenedor;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // sin conversión: los colores ya están en sRGB (también en los shaders)
    this.renderer.setClearColor(0x04070d);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.style.display = "block";
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute(
      "aria-label",
      "Globo terrestre con los sismos del dataset. Flechas para girar, más y menos para acercar. Los controles de abajo hacen lo mismo con botones.",
    );
    contenedor.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, w / Math.max(h, 1), 0.005, 120);
    this.camera.position.set(0, 0, 3);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !this.reducirMovimiento;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = DIST_MIN;
    this.controls.maxDistance = DIST_MAX;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;

    this.#construirMundo(o.tierra);
    this.#construirPuntos();
    this.#construirRegiones();
    this.#construirAnillosAmbiente();
    this.#eventosDeTeclado();
    this.#eventosDePuntero();

    this.observador = new ResizeObserver(() => this.#ajustarTamano());
    this.observador.observe(contenedor);
    this.#ajustarTamano();
    this.ciclo = (t) => this.#bucle(t);
    this.raf = requestAnimationFrame(this.ciclo);
  }

  // ------------------------------------------------------------ construcción
  #construirMundo(tierra) {
    // la esfera oscura y un halo en el borde
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0a1424 })));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.ShaderMaterial({ vertexShader: VERT_ATMOSFERA, fragmentShader: FRAG_ATMOSFERA, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    );
    halo.scale.setScalar(1.16);
    this.scene.add(halo);

    // meridianos y paralelos cada 30 grados
    const grat = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 4) grat.push(...latLonAVec3(lat, lon, 1.0015), ...latLonAVec3(lat, lon + 4, 1.0015));
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) grat.push(...latLonAVec3(lat, lon, 1.0015), ...latLonAVec3(Math.min(lat + 4, 88), lon, 1.0015));
    this.#lineas(grat, 0x1a2a42, 0.8);

    // contorno de los continentes (Natural Earth, dominio público)
    const costa = [];
    const anillo = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) costa.push(...latLonAVec3(pts[i][1], pts[i][0], 1.002), ...latLonAVec3(pts[i + 1][1], pts[i + 1][0], 1.002));
    };
    for (const g of tierra) {
      const poligonos = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
      for (const p of poligonos) for (const r of p) anillo(r);
    }
    this.#lineas(costa, 0x5d7396, 0.75);

    // estrellas
    const rnd = azar(7);
    const est = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(60);
      est.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(est, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x4a5a78, size: 1.3, sizeAttenuation: false })));
  }

  #lineas(vertices, color, opacidad) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad, depthWrite: false }));
    this.scene.add(l);
    return l;
  }

  #construirPuntos() {
    const d = this.datos;
    const n = d.lat.length;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    const tam = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = latLonAVec3(d.lat[i], d.lon[i], RADIO_PUNTOS);
      this.pos.set(v, i * 3);
      tam[i] = 0.0045 + 0.0035 * Math.max(d.mag[i] - 4, 0);
    }
    this.vis = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aTam", new THREE.BufferAttribute(tam, 1));
    g.setAttribute("aVis", new THREE.BufferAttribute(this.vis, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    this.matPuntos = new THREE.ShaderMaterial({
      vertexShader: VERT_PUNTOS, fragmentShader: FRAG_PUNTOS, transparent: true, depthWrite: false,
      uniforms: { uEscala: { value: 800 }, uDim: { value: 1 }, uK: { value: 1 } },
    });
    this.puntos = new THREE.Points(g, this.matPuntos);
    this.puntos.frustumCulled = false;
    this.scene.add(this.puntos);
  }

  #construirRegiones() {
    this.cajas = new Map();
    this.etiquetas = new Map();
    for (const r of this.regiones) {
      const v = [];
      const borde = (lat0, lon0, lat1, lon1) => {
        const pasos = Math.ceil(Math.max(Math.abs(lat1 - lat0), Math.abs(lon1 - lon0)));
        for (let i = 0; i < pasos; i++) v.push(...latLonAVec3(lat0 + ((lat1 - lat0) * i) / pasos, lon0 + ((lon1 - lon0) * i) / pasos, 1.004), ...latLonAVec3(lat0 + ((lat1 - lat0) * (i + 1)) / pasos, lon0 + ((lon1 - lon0) * (i + 1)) / pasos, 1.004));
      };
      borde(r.sur, r.oeste, r.sur, r.este); borde(r.sur, r.este, r.norte, r.este); borde(r.norte, r.este, r.norte, r.oeste); borde(r.norte, r.oeste, r.sur, r.oeste);
      this.cajas.set(r.nombre, this.#lineas(v, 0x8fa6c9, 0.55));
      const e = document.createElement("div");
      e.className = "globo-etiqueta";
      this.contenedor.appendChild(e);
      this.etiquetas.set(r.nombre, { el: e, c: latLonAVec3(centroRegion(r).lat, centroRegion(r).lon, 1.02) });
    }
  }

  #construirAnillosAmbiente() {
    const rnd = azar(11);
    const grandes = [];
    for (let i = 0; i < this.n; i++) if (this.datos.mag[i] >= 7) grandes.push(i);
    this.idxGrandes = grandes;
    const m = grandes.length;
    const pos = new Float32Array(m * 3), mag = new Float32Array(m), fase = new Float32Array(m), col = new Float32Array(m * 3);
    this.visGrandes = new Float32Array(m);
    grandes.forEach((i, k) => {
      pos.set(this.pos.subarray(i * 3, i * 3 + 3), k * 3);
      mag[k] = this.datos.mag[i];
      fase[k] = rnd();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    g.setAttribute("aFase", new THREE.BufferAttribute(fase, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aVis", new THREE.BufferAttribute(this.visGrandes, 1));
    g.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(m), 1));
    this.colGrandes = col;
    this.matAmbiente = this.#materialEventos(1);
    this.ambiente = new THREE.Points(g, this.matAmbiente);
    this.ambiente.frustumCulled = false;
    this.ambiente.visible = !this.reducirMovimiento; // con movimiento reducido no hay pulsos
    this.scene.add(this.ambiente);
  }

  #materialEventos(modo) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT_EVENTOS, fragmentShader: FRAG_EVENTOS, transparent: true, depthWrite: false,
      uniforms: { uEscala: { value: 800 }, uS: { value: 0 }, uTime: { value: 0 }, uModo: { value: modo }, uK: { value: 1 } },
    });
  }

  // ------------------------------------------------------------ filtros y colores
  actualizarFiltros(f) {
    Object.assign(this.filtros, f);
    const { region, magMin, soloTest, colorPor } = this.filtros;
    const idxRegion = region === "todas" ? -1 : this.datos.regiones.indexOf(region);
    const d = this.datos;
    const clases = colorPor === "real" ? d.real : d.pred;
    for (let i = 0; i < this.n; i++) {
      const ok = (idxRegion < 0 || d.region[i] === idxRegion) && d.mag[i] >= magMin && (!soloTest || d.test[i] === 1);
      this.vis[i] = ok ? 1 : 0;
      const c = this.colores[clases[i]];
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    }
    this.puntos.geometry.attributes.aVis.needsUpdate = true;
    this.puntos.geometry.attributes.aColor.needsUpdate = true;
    this.idxGrandes.forEach((i, k) => {
      this.visGrandes[k] = this.vis[i];
      const c = this.colores[clases[i]];
      this.colGrandes[k * 3] = c.r; this.colGrandes[k * 3 + 1] = c.g; this.colGrandes[k * 3 + 2] = c.b;
    });
    this.ambiente.geometry.attributes.aVis.needsUpdate = true;
    this.ambiente.geometry.attributes.aColor.needsUpdate = true;
    this.cantidadVisible = this.vis.reduce((a, b) => a + b, 0);
  }

  resaltarRegion(nombre) {
    for (const [n, l] of this.cajas) {
      l.material.opacity = n === nombre ? 1 : 0.5;
      l.material.color.set(n === nombre ? 0xffffff : 0x8fa6c9);
    }
    for (const [n, e] of this.etiquetas) e.el.classList.toggle("elegida", n === nombre);
  }

  textoEtiquetas(textos) {
    for (const [n, e] of this.etiquetas) e.el.textContent = textos[n] ?? n;
  }

  // ------------------------------------------------------------ cámara
  volarA(lat, lon, distancia, ms = 1400) {
    const destino = new THREE.Vector3(...latLonAVec3(lat, lon, 1)).normalize();
    const origen = this.camera.position.clone();
    if (this.reducirMovimiento || ms <= 0) {
      this.camera.position.copy(destino.multiplyScalar(distancia));
      this.controls.update();
      return;
    }
    this.vuelo = { d0: origen.clone().normalize(), d1: destino, r0: origen.length(), r1: distancia, t0: performance.now(), ms };
    this.controls.enabled = false;
  }

  entradaCinematografica(lat = 12, lon = 120, distancia = 3.1) {
    if (this.reducirMovimiento) return this.volarA(lat, lon, distancia, 0);
    this.camera.position.copy(new THREE.Vector3(...latLonAVec3(30, -20, 1)).multiplyScalar(8));
    this.volarA(lat, lon, distancia, 3400);
  }

  girar(dAzimut, dPolar) {
    const p = new THREE.Spherical().setFromVector3(this.camera.position);
    p.theta -= dAzimut;
    p.phi = Math.min(Math.max(p.phi - dPolar, 0.15), Math.PI - 0.15);
    this.camera.position.setFromSpherical(p);
    this.controls.update();
  }

  acercar(factor) {
    const r = Math.min(Math.max(this.camera.position.length() * factor, DIST_MIN), DIST_MAX);
    this.camera.position.setLength(r);
    this.controls.update();
  }

  // ------------------------------------------------------------ una secuencia animada
  cargarSecuencia(ev, claseIdx) {
    this.limpiarSecuencia();
    const m = ev.h.length;
    const pos = new Float32Array(m * 3), mag = new Float32Array(m), s = new Float32Array(m), col = new Float32Array(m * 3);
    const c = this.colores[claseIdx];
    const centro = new THREE.Vector3();
    for (let i = 0; i < m; i++) {
      const v = latLonAVec3(ev.lat[i], ev.lon[i], RADIO_PUNTOS + 0.002);
      pos.set(v, i * 3);
      mag[i] = ev.mag[i];
      s[i] = tiempoLog(ev.h[i]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      centro.add(new THREE.Vector3(...v));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    g.setAttribute("aS", new THREE.BufferAttribute(s, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aVis", new THREE.BufferAttribute(new Float32Array(m).fill(1), 1));
    g.setAttribute("aFase", new THREE.BufferAttribute(new Float32Array(m), 1));
    this.matSecuencia = this.#materialEventos(0);
    this.matSecuencia.uniforms.uEscala.value = this.matPuntos.uniforms.uEscala.value;
    this.secuencia = new THREE.Points(g, this.matSecuencia);
    this.secuencia.frustumCulled = false;
    this.scene.add(this.secuencia);
    this.matPuntos.uniforms.uDim.value = 0.16; // el resto del mundo queda de fondo
    this.ambiente.visible = false;

    // la cámara va al centro de la secuencia y se acerca MUCHO, para que los eventos se vean separados.
    // Con el campo de visión de 40°, ver un arco de ángulo a (en radianes) exige estar a ~3,3·a de la superficie.
    centro.normalize();
    const angulos = [];
    for (let i = 0; i < m; i++) angulos.push(Math.acos(Math.min(1, centro.dot(new THREE.Vector3(...latLonAVec3(ev.lat[i], ev.lon[i], 1))))));
    angulos.sort((a, b) => a - b);
    const percentil = (p) => angulos[Math.min(m - 1, Math.floor(p * m))];
    const { lat, lon } = vec3ALatLon([centro.x, centro.y, centro.z]);
    this.encuadre = {
      lat, lon,
      nucleo: Math.min(Math.max(1 + 3.3 * percentil(0.8) + 0.015, 1.04), 3.4), // donde está el 80 % de los eventos
      todo: Math.min(Math.max(1 + 3.3 * percentil(1) + 0.03, 1.04), 4.5), // hasta el más lejano
    };
    this.volarA(lat, lon, this.encuadre.nucleo, 2400);
    return this.encuadre;
  }

  // vuelve a encuadrar la secuencia: sólo el núcleo (más zoom) o todos los eventos
  encuadrar(modo) {
    if (!this.encuadre) return;
    this.volarA(this.encuadre.lat, this.encuadre.lon, modo === "todo" ? this.encuadre.todo : this.encuadre.nucleo, 1500);
  }

  fijarTiempo(s) {
    if (this.matSecuencia) this.matSecuencia.uniforms.uS.value = s;
  }

  limpiarSecuencia() {
    if (this.secuencia) {
      this.scene.remove(this.secuencia);
      this.secuencia.geometry.dispose();
      this.matSecuencia.dispose();
      this.secuencia = null;
      this.matSecuencia = null;
    }
    this.matPuntos.uniforms.uDim.value = 1;
    this.ambiente.visible = !this.reducirMovimiento;
  }

  // ------------------------------------------------------------ interacción
  #eventosDeTeclado() {
    this.canvas.addEventListener("keydown", (e) => {
      const paso = 0.12;
      const acciones = { ArrowLeft: () => this.girar(-paso, 0), ArrowRight: () => this.girar(paso, 0), ArrowUp: () => this.girar(0, paso), ArrowDown: () => this.girar(0, -paso), "+": () => this.acercar(0.85), "=": () => this.acercar(0.85), "-": () => this.acercar(1.18) };
      if (acciones[e.key]) {
        e.preventDefault();
        this.vuelo = null;
        this.controls.enabled = true;
        acciones[e.key]();
      }
    });
  }

  #eventosDePuntero() {
    let abajo = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      abajo = { x: e.clientX, y: e.clientY };
      this.vuelo = null; // si el usuario agarra el globo, termina el vuelo
      this.controls.enabled = true;
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 5) return;
      abajo = null;
      const i = this.#puntoCercano(e);
      if (i >= 0) return this.alClickPunto?.(i);
      const sobre = this.#sobreLaEsfera(e);
      if (sobre) this.alClickRegion?.(regionDe(sobre.lat, sobre.lon, this.regiones));
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (e.buttons) return;
      const i = this.#puntoCercano(e);
      if (i !== this.hoverIdx) this.hoverIdx = i;
      const r = this.canvas.getBoundingClientRect();
      this.alHover?.(i, e.clientX - r.left, e.clientY - r.top);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hoverIdx = -1;
      this.alHover?.(-1, 0, 0);
    });
  }

  #sobreLaEsfera(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rayo = new THREE.Raycaster();
    rayo.setFromCamera(ndc, this.camera);
    const o = rayo.ray.origin, d = rayo.ray.direction;
    const b = o.dot(d), c = o.dot(o) - 1; // intersección de la recta con la esfera de radio 1
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return vec3ALatLon(o.clone().addScaledVector(d, t).toArray());
  }

  // el punto visible más cercano al puntero (a menos de 12 px), proyectando a mano: 21 mil cuentas por movimiento
  #puntoCercano(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    this.camera.updateMatrixWorld();
    const m = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).elements;
    const c = this.camera.position;
    const limite2 = 12 * 12;
    let mejor = -1, mejor2 = limite2;
    for (let i = 0; i < this.n; i++) {
      if (this.vis[i] === 0) continue;
      const x = this.pos[i * 3], y = this.pos[i * 3 + 1], z = this.pos[i * 3 + 2];
      if (x * c.x + y * c.y + z * c.z < 1.012) continue; // del otro lado del horizonte
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * r.width;
      const sy = (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5 + 0.5)) * r.height;
      const d2 = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d2 < mejor2) { mejor2 = d2; mejor = i; }
    }
    return mejor;
  }

  // ------------------------------------------------------------ bucle
  #ajustarTamano() {
    const w = this.contenedor.clientWidth, h = this.contenedor.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const escala = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
    // gl_PointSize se mide en píxeles del buffer de dibujo, por eso se multiplica por la densidad de píxeles
    for (const m of [this.matPuntos, this.matAmbiente, this.matSecuencia]) if (m) m.uniforms.uEscala.value = escala;
  }

  // al acercar la cámara, los puntos se achican (en unidades del mundo) y el giro se vuelve más fino
  #ajustarSegunDistancia() {
    const d = this.camera.position.length();
    const k = Math.min(Math.max((d - 1) / (DIST_REF - 1), 0.03), 1);
    for (const m of [this.matPuntos, this.matAmbiente, this.matSecuencia]) if (m) m.uniforms.uK.value = k;
    this.controls.rotateSpeed = 0.55 * Math.min(Math.max((d - 1) / (DIST_REF - 1), 0.12), 1);
  }

  #etiquetasEnPantalla() {
    const w = this.contenedor.clientWidth, h = this.contenedor.clientHeight;
    const c = this.camera.position;
    const v = new THREE.Vector3();
    for (const { el, c: p } of this.etiquetas.values()) {
      if (p[0] * c.x + p[1] * c.y + p[2] * c.z < 1.02) { el.style.display = "none"; continue; }
      v.set(...p).project(this.camera);
      el.style.display = "block";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    }
  }

  #bucle(ahora) {
    if (!this.activo) return;
    this.raf = requestAnimationFrame(this.ciclo);
    this.tiempo = ahora / 1000;
    if (this.matAmbiente) this.matAmbiente.uniforms.uTime.value = this.tiempo;
    if (this.vuelo) {
      const f = this.vuelo;
      const t = Math.min((ahora - f.t0) / f.ms, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(f.d0, f.d1);
      const qi = new THREE.Quaternion().slerp(q, suavizar(t));
      const dir = f.d0.clone().applyQuaternion(qi);
      this.camera.position.copy(dir.multiplyScalar(f.r0 + (f.r1 - f.r0) * suavizar(t)));
      this.camera.lookAt(0, 0, 0);
      if (t >= 1) { this.vuelo = null; this.controls.enabled = true; }
    }
    this.#ajustarSegunDistancia();
    this.controls.update();
    this.#etiquetasEnPantalla();
    this.renderer.render(this.scene, this.camera);
  }

  pausar(pausa) {
    if (pausa === !this.activo) return;
    this.activo = !pausa;
    if (this.activo) this.raf = requestAnimationFrame(this.ciclo);
    else cancelAnimationFrame(this.raf);
  }

  destruir() {
    this.activo = false;
    cancelAnimationFrame(this.raf);
    this.observador.disconnect();
    this.controls.dispose();
    this.limpiarSecuencia();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    this.renderer.dispose();
    this.canvas.remove();
    for (const { el } of this.etiquetas.values()) el.remove();
  }
}
