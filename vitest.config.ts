import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Configuración de pruebas separada de vite.config.ts (vitest 3 empaqueta su propia versión de Vite).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
