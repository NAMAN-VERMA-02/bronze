import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        kinetic: 'kinetic.html',
      },
    },
  },
})
