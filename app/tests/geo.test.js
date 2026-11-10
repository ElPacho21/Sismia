import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { centroRegion, eventosHasta, horasATexto, horasDeTiempoLog, latLonAVec3, regionDe, suavizar, tiempoLog, vec3ALatLon } from "../src/globo/geo.js";

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const regiones = leer("../public/data/regiones.json");

describe("latitud y longitud sobre la esfera", () => {
  it("el polo norte está arriba y la longitud 0 mira a +x", () => {
    expect(latLonAVec3(90, 0)[1]).toBeCloseTo(1);
    const v = latLonAVec3(0, 0);
    [1, 0, 0].forEach((esperado, i) => expect(v[i]).toBeCloseTo(esperado, 9));
  });
  it("ida y vuelta devuelve el mismo punto", () => {
    for (const [lat, lon] of [[-33.4, -70.6], [35.7, 139.7], [14.6, 121], [-6.2, 106.8], [0, 179.9], [89, -3]]) {
      const v = vec3ALatLon(latLonAVec3(lat, lon, 1.7));
      expect(v.lat).toBeCloseTo(lat, 9);
      expect(v.lon).toBeCloseTo(lon, 9);
    }
  });
  it("todos los puntos caen sobre la esfera", () => {
    expect(Math.hypot(...latLonAVec3(12, 34, 2))).toBeCloseTo(2);
  });
});

describe("regiones", () => {
  it("ubica un punto en su región y fuera de todas devuelve null", () => {
    expect(regionDe(35.7, 139.7, regiones)).toBe("japan");
    expect(regionDe(-33.4, -70.6, regiones)).toBe("andes");
    expect(regionDe(0, -140, regiones)).toBeNull();
  });
  it("el centro de cada región cae dentro de ella", () => {
    for (const r of regiones) {
      const c = centroRegion(r);
      expect(regionDe(c.lat, c.lon, regiones)).not.toBeNull();
    }
  });
});

describe("el reloj logarítmico de la animación", () => {
  it("ida y vuelta entre horas y tiempo logarítmico", () => {
    for (const h of [0, 0.5, 3, 24, 700, 20000]) expect(horasDeTiempoLog(tiempoLog(h))).toBeCloseTo(h, 6);
  });
  it("las primeras horas ocupan tanto como los últimos meses", () => {
    expect(tiempoLog(9) - tiempoLog(0)).toBeCloseTo(1); // 0 a 9 horas
    expect(tiempoLog(99) - tiempoLog(9)).toBeCloseTo(1); // 9 a 99 horas
  });
  it("cuenta cuántos eventos ya ocurrieron", () => {
    const horas = [0, 1, 5, 100, 5000];
    expect(eventosHasta(horas, 0)).toBe(1);
    expect(eventosHasta(horas, tiempoLog(5))).toBe(3);
    expect(eventosHasta(horas, tiempoLog(5000))).toBe(5);
  });
  it("escribe el tiempo en la unidad que corresponde", () => {
    expect(horasATexto(0.25)).toBe("15 min");
    expect(horasATexto(5)).toBe("5,0 horas");
    expect(horasATexto(24 * 10)).toBe("10,0 días");
    expect(horasATexto(24 * 365 * 3)).toBe("3,0 años");
  });
});

describe("suavizado de la cámara", () => {
  it("arranca en 0, termina en 1 y es monótono", () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.3)).toBeLessThan(suavizar(0.7));
  });
});

describe("los datos del globo", () => {
  const g = leer("../public/data/globo.json");
  const filas = leer("../public/data/explora_filas.json");
  it("van en el mismo orden que las filas de Explorá (el detalle se lee de ahí)", () => {
    expect(g.lat.length).toBe(filas.length);
    for (const i of [0, 777, 9999, 21291]) {
      expect(g.lat[i]).toBe(filas[i].lat);
      expect(g.lon[i]).toBe(filas[i].lon);
      expect(g.mag[i]).toBe(filas[i].mag);
      expect(g.real[i]).toBe(filas[i].real_i);
      expect(g.pred[i]).toBe(filas[i].pred_i);
      expect(g.test[i]).toBe(filas[i].test);
    }
  });
  it("cada punto cae en la región que dice su columna", () => {
    for (let i = 0; i < g.lat.length; i += 53) expect(regionDe(g.lat[i], g.lon[i], regiones)).not.toBeNull();
  });
  it("las secuencias animables tienen sus eventos", () => {
    const eventos = leer("../public/data/eventos_secuencias.json");
    const ids = g.id.filter(Boolean);
    expect(ids.length).toBe(Object.keys(eventos).length);
    for (const d of g.destacadas) {
      expect(eventos[d.id].h.length).toBe(d.eventos);
      expect(eventos[d.id].h[0]).toBe(0); // el primero es el principal (root)
    }
  });
});
