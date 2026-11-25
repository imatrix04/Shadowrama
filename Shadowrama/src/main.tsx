import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/bricolage-grotesque/latin-400.css'
import '@fontsource/bricolage-grotesque/latin-600.css'
import '@fontsource/bricolage-grotesque/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/lato/latin-400.css'
import '@fontsource/lato/latin-700.css'
import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/oswald/latin-400.css'
import '@fontsource/oswald/latin-700.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/dancing-script/latin-400.css'
import '@fontsource/dancing-script/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import '@fontsource/bebas-neue/latin-400.css'
import '@fontsource/pacifico/latin-400.css'
import '@fontsource/permanent-marker/latin-400.css'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'
import { loadThemeMode, resolveTheme, applyTheme, loadPalette, applyPalette } from './utils/theme'

applyTheme(resolveTheme(loadThemeMode()))
applyPalette(loadPalette())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)