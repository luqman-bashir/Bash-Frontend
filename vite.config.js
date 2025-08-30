// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // listen on 0.0.0.0 inside the container
    port: 5173,        // make sure compose publishes 5173:5173
    proxy: {
      "/api": {
        target: "http://backend:5000", // Docker service name for your Flask app
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""), // /api/login -> /login
      },
    },
  },
});
