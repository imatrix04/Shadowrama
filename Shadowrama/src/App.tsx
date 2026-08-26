import { HashRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Home from './pages/Home'
import Editor from './pages/Editor'

export default function App() {
  return (
    // La frontière entoure le routeur : une exception dans l'éditeur ne doit pas
    // laisser une fenêtre vide, mais un écran qui explique et propose de
    // recharger (voir ErrorBoundary).
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/editor" element={<Editor />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
