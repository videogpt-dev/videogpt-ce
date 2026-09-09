import { fileURLToPath } from "node:url";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const uiSrc = fileURLToPath(new URL("../../packages/videogpt-ui/src", import.meta.url));
const publicDir = fileURLToPath(new URL("../../assets", import.meta.url));

export default {
  publicDir,
  plugins: [tailwindcss(), reactRouter()],
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
  ssr: {
    noExternal: [/^@videogpt\//],
  },
};
