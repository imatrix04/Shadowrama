import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Configuration de test séparée de `vite.config.ts`.
 *
 * La configuration de build embarque `vite-plugin-electron`, qui compile et
 * relance le process Electron à chaque démarrage : hors de question de payer ça
 * pour lancer des tests unitaires.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // `jsdom` sert aux tests de hooks React ; les modules purs n'en dépendent pas.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
