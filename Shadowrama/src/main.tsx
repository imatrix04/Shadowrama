import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées : l'application est packagée en Electron et doit rester
// lisible hors ligne, ce que ne permettait pas le <link> vers Google Fonts.
import '@fontsource/bricolage-grotesque/latin-400.css'
import '@fontsource/bricolage-grotesque/latin-600.css'
import '@fontsource/bricolage-grotesque/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
