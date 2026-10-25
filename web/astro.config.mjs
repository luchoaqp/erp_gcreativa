import { defineConfig } from 'astro/config';

// Sitio 100% estático: `npm run build` genera la carpeta dist/ lista para subir a public_html.
export default defineConfig({
  site: 'https://gcreativa.com',
  output: 'static',
  build: {
    // /nosotros/index.html → URLs limpias (gcreativa.com/nosotros/) que Apache sirve sin configuración extra
    format: 'directory',
  },
  server: { port: 4321 },
});
