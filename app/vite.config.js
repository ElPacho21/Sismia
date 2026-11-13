import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api va al FastAPI local (uvicorn api.main:app --port 8000).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  preview: { proxy: { "/api": "http://localhost:8000" } }, // para probar el sitio compilado con la API local
  test: { include: ["tests/**/*.test.js"] },
});
