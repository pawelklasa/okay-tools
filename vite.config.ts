import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cloudflare Pages serves at the root; GitHub Pages serves under /okay-tools/.
// CF_PAGES is set automatically in the Cloudflare Pages build environment.
const base = process.env.CF_PAGES ? '/' : '/okay-tools/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
