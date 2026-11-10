import { defineConfig } from "@playwright/test";

// Tests end-to-end con el Edge que ya está instalado (no se descarga ningún navegador).
//   npm run e2e                                     -> levanta la API local y el sitio compilado
//   BASE_URL=https://sisimia.vercel.app npm run e2e -> los mismos tests contra la URL pública
const BASE = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE ?? "http://localhost:4173",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 900 },
    // WebGL por software, para que el globo se dibuje también sin placa de video
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: BASE
    ? undefined
    : [
        {
          command: ".venv\\Scripts\\python.exe -m uvicorn api.main:app --port 8000 --log-level warning",
          cwd: "..",
          url: "http://localhost:8000/api/health",
          reuseExistingServer: true,
          timeout: 60_000,
        },
        { command: "npm run build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: true, timeout: 120_000 },
      ],
});
