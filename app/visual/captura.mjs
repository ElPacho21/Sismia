// Capturas por sección + snapshot de textos. Uso: node visual/captura.mjs <antes|despues>
// BASE_URL opcional (por defecto el sitio compilado en :4173). No cambia nada de la app.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const etapa = process.argv[2] ?? "antes";
const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const salida = new URL(`./${etapa}/`, import.meta.url);
mkdirSync(salida, { recursive: true });

const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const SECCIONES = ["proyecto", "datos", "encontramos", "modelo", "explora", "proba", "globo"];
const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1440, height: 900 } },
  { nombre: "movil", viewport: { width: 390, height: 844 } },
];

// Todo el texto del DOM (también el de los <details> cerrados), una línea por bloque de texto.
const textosDelDom = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let nodo = w.nextNode(); nodo; nodo = w.nextNode()) {
    const el = nodo.parentElement;
    if (!el || ["SCRIPT", "STYLE"].includes(el.tagName)) continue;
    const t = nodo.textContent.replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
};
// Atributos que ve o lee una persona: aria-label, title, placeholder, alt.
const atributosDelDom = () =>
  [...document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")].flatMap((e) =>
    ["aria-label", "title", "placeholder", "alt"].filter((a) => e.hasAttribute(a)).map((a) => `${e.tagName.toLowerCase()}[${a}] ${e.getAttribute(a)}`),
  );

for (const vista of VISTAS) {
  const page = await browser.newPage({ viewport: vista.viewport });
  await page.goto(BASE);
  await page.locator("h1").waitFor();
  // espera a que los gráficos de Vega estén dibujados y el globo cargado
  await page.locator("#datos svg, #datos canvas").first().waitFor({ timeout: 30000 });
  await page.locator("#globo").scrollIntoViewIfNeeded();
  await page.locator(".globo-caja canvas").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // 1. páginas completas
  await page.screenshot({ path: new URL(`pagina-${vista.nombre}.png`, salida).pathname.slice(1), fullPage: true });

  // 2. cada sección por separado (en el estado inicial: «Cómo lo sabemos» cerrado)
  for (const id of SECCIONES) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await el.screenshot({ path: new URL(`${id}-${vista.nombre}.png`, salida).pathname.slice(1) });
  }

  // 3. un «Cómo lo sabemos» abierto, y la barra de navegación
  if (vista.nombre === "escritorio") {
    const como = page.locator("#datos details.como").first();
    await como.locator("summary").click();
    await page.waitForTimeout(400);
    await como.screenshot({ path: new URL(`como-abierto-${vista.nombre}.png`, salida).pathname.slice(1) });
    await como.locator("summary").click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("nav").screenshot({ path: new URL(`barra-${vista.nombre}.png`, salida).pathname.slice(1) });
  }

  // 4. textos (una sola vez, en escritorio): estado inicial + todos los <details> abiertos
  if (vista.nombre === "escritorio") {
    const inicial = await page.evaluate(textosDelDom);
    const attrs = await page.evaluate(atributosDelDom);
    const abiertos = await page.evaluate(() => document.querySelectorAll("details[open]").length);
    writeFileSync(new URL("textos.txt", salida), [...inicial, "--- atributos ---", ...attrs].join("\n") + "\n");
    writeFileSync(new URL("meta.json", salida), JSON.stringify({ etapa, base: BASE, bloques: inicial.length, atributos: attrs.length, detailsAbiertosPorDefecto: abiertos }, null, 2));
  }
  await page.close();
}
await browser.close();
console.log(`listo: ${etapa}`);
