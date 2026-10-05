import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plain client-side-rendered SPA: `vite build` emits static files to `dist/`.
// Port 3001 matches packages/api's default CLIENT_URL (CORS + trustedOrigins).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact()],
  server: { port: 3001 },
  preview: { port: 3001 },
})
