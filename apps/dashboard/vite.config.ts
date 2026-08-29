import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const uiSrc = fileURLToPath(new URL("../../packages/videogpt-ui/src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@videogpt/ui", replacement: `${uiSrc}/index.ts` },
      { find: /^@\//, replacement: `${uiSrc}/` },
    ],
  },
  server: {
    port: Number(process.env.DASHBOARD_PORT) || 5173,
    host: "127.0.0.1",
  },
});
