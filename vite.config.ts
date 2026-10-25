import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // pre-bundle the lazily imported client so the dev server never reloads mid-session to optimise it
  optimizeDeps: { include: ['@supabase/supabase-js', 'three', 'three/examples/jsm/controls/OrbitControls.js', 'three/examples/jsm/loaders/GLTFLoader.js'] },
  // two pages: the game (index.html) and the landing page (landing.html)
  build: { rolldownOptions: { input: { game: 'app.html', landing: 'index.html' } } },
})
