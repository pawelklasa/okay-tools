import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cloudflare Pages and Netlify serve at the root; GitHub Pages serves under /okay-tools/.
// CF_PAGES / NETLIFY are set automatically in those build environments.
const base = process.env.CF_PAGES || process.env.NETLIFY ? '/' : '/okay-tools/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
