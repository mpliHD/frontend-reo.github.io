import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/cptm-monitoramento-armazem/",
  // O index.html da raiz é a página publicada no GitHub Pages: ele aponta para
  // o arquivo compilado dentro de dist/. Por isso o Vite usa o app.html como
  // entrada do código-fonte (npm run dev abre o app.html; npm run build compila a partir dele).
  build: {
    rollupOptions: {
      input: "app.html",
      // Mantém o nome index-XXXX.js que o index.html da raiz já usa.
      output: { entryFileNames: "assets/index-[hash].js" },
    },
  },
  server: { open: "/cptm-monitoramento-armazem/app.html" },
});
