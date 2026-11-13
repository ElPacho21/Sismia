// Paridad JS <-> modelo original de scikit-learn: tests/golden.json lo genera build_app.py con el modelo del notebook.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { predecir } from "../src/modelo.js";

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const modelo = leer("../public/data/model.json");
const golden = leer("../../tests/golden.json");

describe("paridad con el modelo del notebook", () => {
  it("hay casos de grilla, aleatorios, de borde y todo el test", () => {
    expect(golden.length).toBeGreaterThan(4259);
  });

  it("da la misma clase en el 100 % de los casos", () => {
    const distintos = golden.filter((g) => predecir(modelo, g.mag, g.prof, g.region).clase !== g.clase);
    expect(distintos).toEqual([]);
  });

  it("las probabilidades difieren menos de 1e-9", () => {
    let maxima = 0;
    for (const g of golden) {
      const { probs } = predecir(modelo, g.mag, g.prof, g.region);
      probs.forEach((p, i) => (maxima = Math.max(maxima, Math.abs(p - g.probs[i]))));
    }
    expect(maxima).toBeLessThanOrEqual(1e-9);
  });

  it("las réplicas esperadas coinciden (error relativo < 1e-9)", () => {
    for (const g of golden) {
      const { mu } = predecir(modelo, g.mag, g.prof, g.region);
      expect(Math.abs(mu - g.mu) / Math.max(g.mu, 1e-12)).toBeLessThan(1e-9);
    }
  });

  it("la clase más probable es la de mayor probabilidad cruda", () => {
    for (const g of golden) {
      const { claseMasProbable } = predecir(modelo, g.mag, g.prof, g.region);
      expect(claseMasProbable).toBe(modelo.clases[g.probs.indexOf(Math.max(...g.probs))]);
    }
  });
});
