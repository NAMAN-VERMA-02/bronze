import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        kinetic: 'kinetic.html',
        forge: 'forge.html',
      },
    },
  },
})
