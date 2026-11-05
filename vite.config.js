import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build output goes straight into Flask's static folder; templates/index.html
// is the single-page shell that loads it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "static/assets",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        entryFileNames: "app.[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/webhook": "http://127.0.0.1:5000",
    },
  },
});
