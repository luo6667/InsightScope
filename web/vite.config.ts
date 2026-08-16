import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      "/api": { target: "http://localhost:5176", changeOrigin: true },
      "/socket.io": { target: "http://localhost:5176", ws: true },
    },
  },
});
