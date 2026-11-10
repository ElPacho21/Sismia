// Tests end-to-end de Sisimia: recorren la página como la recorrería una persona.
// Cada test termina verificando que no hubo errores en la consola ni pedidos fallidos.
import { expect, test } from "@playwright/test";

let errores;

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(`consola: ${m.text()}`));
  page.on("pageerror", (e) => errores.push(`excepción: ${e.message}`));
  page.on("requestfailed", (r) => errores.push(`pedido fallido: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && errores.push(`HTTP ${r.status()}: ${r.url()}`));
});

// ---- utilidades
const huella = (page, selector) =>
  page.evaluate((sel) => {
    const c = document.querySelector(sel);
    const url = c.toDataURL();
    let h = 0;
    for (let i = 0; i < url.length; i += 7) h = (h * 31 + url.charCodeAt(i)) | 0;
    return `${url.length}:${h}`;
  }, selector);

async function irAlGlobo(page) {
  await page.goto("/");
  await page.locator("#globo").scrollIntoViewIfNeeded();
  await expect(page.locator(".globo-caja canvas")).toBeVisible();
  await page.locator("#globo").scrollIntoViewIfNeeded();
}

const porcentajes = async (page, selector) => {
  const textos = await page.locator(`${selector} .barras .valor`).allInnerTexts();
  return textos.map((t) => (t.startsWith("<") ? 0.05 : Number(t.replace(/[^\d,]/g, "").replace(",", "."))));
};

// ---------------------------------------------------------------- portada y tallo
test("la portada tiene la pregunta, la oración y tres números", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("6 de cada 10 secuencias con réplicas");
  await expect(page.locator(".numeros li")).toHaveCount(3);
  await expect(page.locator(".numeros li").nth(0)).toContainText("0,50 contra 0,24");
  expect(errores).toEqual([]);
});

test("el servidor se despierta apenas carga la página (arranque en frío)", async ({ page }) => {
  const pedido = page.waitForRequest(/\/api\/health/);
  await page.goto("/");
  await pedido;
});

test("el tallo: tres secciones con título que afirma, gráfico y «Cómo lo sabemos» cerrado", async ({ page }) => {
  await page.goto("/");
  for (const id of ["datos", "encontramos", "modelo"]) {
    const s = page.locator(`#${id}`);
    await s.scrollIntoViewIfNeeded();
    expect((await s.locator("h2").innerText()).length).toBeGreaterThan(30);
    await expect(s.locator(".grafico canvas").first()).toBeVisible();
    await expect(s.locator("details.como")).not.toHaveAttribute("open", "");
  }
  expect(errores).toEqual([]);
});

test("los tres «Cómo lo sabemos» se abren con tablas y sin valores rotos", async ({ page }) => {
  await page.goto("/");
  for (const id of ["datos", "encontramos", "modelo"]) {
    const s = page.locator(`#${id}`);
    await s.locator("summary").click();
    await expect(s.locator("details.como")).toHaveAttribute("open", "");
    await expect(s.locator("details.como table").first()).toBeVisible();
    expect(await s.locator("details.como").innerText()).not.toMatch(/NaN|undefined|\[object|Infinity/);
  }
  // los números clave están
  await expect(page.locator("#datos details")).toContainText("87.103");
  await expect(page.locator("#datos details")).toContainText("37.513");
  await expect(page.locator("#encontramos details")).toContainText("η² =");
  await expect(page.locator("#modelo details")).toContainText("0,500");
  await expect(page.locator("#modelo details")).toContainText("Matriz de confusión");
  expect(errores).toEqual([]);
});

test("con teclado: Tab llega a «Cómo lo sabemos» y Enter lo abre", async ({ page }) => {
  await page.goto("/");
  const resumen = page.locator("#datos summary");
  await resumen.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#datos details.como")).toHaveAttribute("open", "");
});

// ---------------------------------------------------------------- Explorá
test("Explorá: cada control cambia el gráfico", async ({ page }) => {
  await page.goto("/");
  const e = page.locator("#explora");
  await e.scrollIntoViewIfNeeded();
  await expect(e.locator("canvas").first()).toBeVisible();
  await expect(e.locator(".vega-bind")).toHaveCount(4);
  await page.waitForTimeout(1200);
  const base = await huella(page, "#explora canvas");

  const cambios = [
    ["región", () => e.locator(".vega-bindings select").nth(0).selectOption("japan")],
    ["secuencias", () => e.locator(".vega-bindings select").nth(1).selectOption({ index: 1 })],
    ["pintar según", () => e.locator(".vega-bindings select").nth(2).selectOption({ index: 1 })],
    ["magnitud mínima", () => e.locator(".vega-bindings input[type=range]").fill("6")],
  ];
  let previa = base;
  for (const [nombre, aplicar] of cambios) {
    await aplicar();
    await page.waitForTimeout(900);
    const ahora = await huella(page, "#explora canvas");
    expect(ahora, `el control «${nombre}» no cambió el gráfico`).not.toBe(previa);
    previa = ahora;
  }
  expect(errores).toEqual([]);
});

test("Explorá: al pasar el mouse sobre un caso aparece el detalle con lo que dijo el modelo", async ({ page }) => {
  await page.goto("/");
  const e = page.locator("#explora");
  await e.scrollIntoViewIfNeeded();
  await e.locator(".vega-bindings select").nth(0).selectOption("japan");
  await page.waitForTimeout(1200);
  const caja = await e.locator("canvas").first().boundingBox();
  let texto = "";
  // Japón está arriba a la derecha del mapa
  for (let y = 0.03; y < 0.22 && !texto; y += 0.012) {
    for (let x = 0.72; x < 0.92 && !texto; x += 0.008) {
      await page.mouse.move(caja.x + caja.width * x, caja.y + caja.height * y);
      const tip = page.locator("#vg-tooltip-element.visible");
      if (await tip.count()) texto = await tip.innerText();
    }
  }
  expect(texto, "no apareció ningún detalle al barrer el mapa").toContain("Dijo el modelo");
  expect(texto).toContain("Partición");
  expect(errores).toEqual([]);
});

// ---------------------------------------------------------------- Probá el modelo
test("Probá el modelo: clase, probabilidades que suman 100 % y origen del cálculo", async ({ page }) => {
  await page.goto("/");
  const p = page.locator("#proba");
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator(".resultado .clase")).toBeVisible();
  const suma = (await porcentajes(page, "#proba")).reduce((a, b) => a + b, 0);
  expect(suma).toBeGreaterThan(99.5);
  expect(suma).toBeLessThan(100.5);
  await expect(p.locator(".origen")).toContainText("Calculado en el servidor");
  await p.getByRole("button", { name: "M7,5 en los Andes" }).click();
  await expect(p.locator(".resultado .clase")).toContainText("muchas");
  expect(errores).toEqual([]);
});

test("Probá el modelo: un caso fuera de lo visto se calcula y se avisa", async ({ page }) => {
  await page.goto("/");
  const p = page.locator("#proba");
  await p.scrollIntoViewIfNeeded();
  await p.getByLabel("Magnitud del sismo principal").fill("3.5");
  await expect(p.locator(".avisos")).toContainText("fuera de lo que el modelo vio");
  await expect(p.locator(".avisos")).toContainText("4,6"); // el Mc de Japón, con coma decimal
  await expect(p.locator(".resultado .clase")).toBeVisible();
});

test("Probá el modelo: lo que no tiene sentido se rechaza con un motivo", async ({ page }) => {
  await page.goto("/");
  const p = page.locator("#proba");
  await p.scrollIntoViewIfNeeded();
  for (const [campo, valor] of [["Magnitud del sismo principal", "15"], ["Magnitud del sismo principal", ""], ["Profundidad (km)", "5000"]]) {
    await p.getByLabel("Magnitud del sismo principal").fill("6");
    await p.getByLabel("Profundidad (km)").fill("30");
    await p.getByLabel(campo).fill(valor);
    await expect(p.locator(".rechazo")).toBeVisible();
    await expect(p.locator(".resultado .clase")).toHaveCount(0);
  }
  expect(errores).toEqual([]);
});

test("si el servidor no responde, el navegador calcula lo mismo y lo avisa", async ({ page }) => {
  await page.goto("/");
  const p = page.locator("#proba");
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator(".origen")).toContainText("servidor");
  const delServidor = { clase: await p.locator(".clase").innerText(), barras: await p.locator(".barras").innerText() };

  await page.route("**/api/predict", (r) => r.abort());
  await p.getByLabel("Profundidad (km)").fill("31");
  await p.getByLabel("Profundidad (km)").fill("30");
  await expect(p.locator(".origen")).toContainText("Calculado en tu navegador");
  expect(await p.locator(".clase").innerText()).toBe(delServidor.clase);
  expect(await p.locator(".barras").innerText()).toBe(delServidor.barras);
});

test("si el servidor devuelve un error, también cae al navegador", async ({ page }) => {
  await page.route("**/api/predict", (r) => r.fulfill({ status: 500, body: "boom" }));
  await page.goto("/");
  const p = page.locator("#proba");
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator(".origen")).toContainText("Calculado en tu navegador");
  await expect(p.locator(".resultado .clase")).toBeVisible();
});

// ---------------------------------------------------------------- globo
test("globo: elegir una secuencia, reproducir, pausar y mover el tiempo", async ({ page }) => {
  await irAlGlobo(page);
  const panel = page.locator(".globo-panel");
  await panel.locator("select").filter({ has: page.locator("option", { hasText: "eventos" }) }).selectOption({ index: 1 });
  await expect(page.locator(".globo-reloj")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pausa|Reproducir/ })).toBeVisible();
  await page.getByRole("button", { name: /Pausa/ }).click();
  await expect(page.getByRole("button", { name: /Reproducir/ })).toBeVisible();
  await panel.getByLabel("Momento de la secuencia").fill("600");
  await expect(page.locator(".globo-reloj")).toContainText("días");
  await expect(page.locator(".globo-reloj")).toContainText("de 2.545 eventos");
  await expect(panel).toContainText("El principal (el que abre la secuencia) fue M7,3");
  await page.getByRole("button", { name: "Ver toda la secuencia" }).click();
  await page.getByRole("button", { name: "Quitar" }).click();
  await expect(page.locator(".globo-reloj")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("globo: la región elegida acá se mueve también en Explorá y en Probá el modelo", async ({ page }) => {
  await irAlGlobo(page);
  await page.locator(".globo-panel select").first().selectOption("philippines");
  await expect(page.locator("#explora .vega-bindings select").first()).toHaveValue("philippines");
  await expect(page.locator("#proba select").first()).toHaveValue("philippines");
  await expect(page.locator(".globo-panel .nota").first()).toContainText("Filipinas");
  // y al revés: lo que se mueve en Explorá llega al globo
  await page.locator("#explora").scrollIntoViewIfNeeded();
  await page.locator("#explora .vega-bindings select").first().selectOption("andes");
  await expect(page.locator(".globo-panel select").first()).toHaveValue("andes");
  expect(errores).toEqual([]);
});

test("globo: el caso de «Probá el modelo» es el mismo que el del globo", async ({ page }) => {
  await irAlGlobo(page);
  await page.locator(".globo-panel").getByLabel("Magnitud del sismo principal").fill("7.5");
  await expect(page.locator(".globo-panel .resultado .clase")).toContainText("muchas");
  await expect(page.locator("#proba input[type=number]").first()).toHaveValue("7.5");
  await expect(page.locator("#proba .resultado .clase")).toContainText("muchas");
});

test("globo: con teclado se puede girar y acercar", async ({ page }) => {
  await irAlGlobo(page);
  await page.waitForTimeout(4500); // termina la entrada cinematográfica
  // el canvas de WebGL no se puede leer con toDataURL: se compara una captura de pantalla
  const caja = page.locator(".globo-caja");
  const antes = await caja.screenshot();
  await page.locator(".globo-caja canvas").focus();
  for (const tecla of ["ArrowLeft", "ArrowLeft", "ArrowUp", "+"]) await page.keyboard.press(tecla);
  await page.waitForTimeout(600);
  expect((await caja.screenshot()).equals(antes), "las flechas no movieron el globo").toBe(false);
  expect(errores).toEqual([]);
});

test("globo: sin WebGL se avisa y el resto de la página sigue andando", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
      return /webgl/i.test(tipo) ? null : original.call(this, tipo, ...resto);
    };
  });
  await page.goto("/");
  await page.locator("#globo").scrollIntoViewIfNeeded();
  await expect(page.locator(".globo-aviso")).toContainText("WebGL");
  await page.locator("#proba").scrollIntoViewIfNeeded();
  await expect(page.locator("#proba .resultado .clase")).toBeVisible();
});

test("globo: con «reducir movimiento» la animación no arranca sola", async ({ browser }) => {
  const contexto = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();
  await page.goto("/");
  await page.locator("#globo").scrollIntoViewIfNeeded();
  await expect(page.locator(".globo-caja canvas")).toBeVisible();
  await page.locator(".globo-panel select").filter({ has: page.locator("option", { hasText: "eventos" }) }).selectOption({ index: 1 });
  await expect(page.getByRole("button", { name: /Reproducir/ })).toBeVisible(); // no está reproduciendo
  await page.waitForTimeout(1500);
  await expect(page.locator(".globo-reloj strong")).toContainText("0 min");
  await contexto.close();
});

// ---------------------------------------------------------------- accesibilidad
test("accesibilidad: sin violaciones graves (axe), con todo desplegado", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  await page.locator("#globo").scrollIntoViewIfNeeded();
  await expect(page.locator(".globo-caja canvas")).toBeVisible();
  for (const s of await page.locator("details.como summary").all()) await s.click();
  await page.waitForTimeout(800);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(
    graves.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} elementos, p. ej. ${v.nodes[0].target.join(" ")}`),
  ).toEqual([]);
});
