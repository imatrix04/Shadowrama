import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

/**
 * Politique de sécurité du contenu.
 *
 * L'application fonctionne entièrement hors ligne : polices embarquées, images
 * servies en `blob:` depuis le store média, aucune ressource distante. La
 * politique l'écrit noir sur blanc — une injection dans le renderer ne pourrait
 * alors ni charger du code, ni renvoyer quoi que ce soit vers l'extérieur.
 *
 * Elle est injectée à la construction plutôt qu'écrite en dur dans index.html :
 * le serveur de développement de Vite a besoin d'un préambule inline et d'un
 * WebSocket que la version packagée n'a aucune raison d'autoriser.
 */
const CSP_COMMON = [
  "default-src 'none'",
  // Les styles en ligne sont la norme dans ce projet (prop `style` de React,
  // écritures de GSAP), et les modules CSS produisent une feuille locale.
  "style-src 'self' 'unsafe-inline'",
  // `blob:` couvre les images du store média, `data:` les icônes embarquées.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
]

const CSP_PROD = [
  ...CSP_COMMON,
  "script-src 'self'",
  "connect-src 'self' blob: data:",
].join('; ')

const CSP_DEV = [
  ...CSP_COMMON,
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
].join('; ')

export default defineConfig({
  plugins: [
    {
      name: 'shadowrama-csp',
      transformIndexHtml(html, ctx) {
        return html.replace('%CSP%', ctx.server ? CSP_DEV : CSP_PROD)
      },
    },
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
      {
        entry: 'electron/update-window/updatePreload.ts',
      },
    ]),
    renderer(),
  ],
})
