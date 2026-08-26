import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Filet de sécurité contre l'écran blanc.
 *
 * Sans lui, la moindre exception pendant un rendu démonte tout l'arbre React :
 * l'application reste ouverte mais entièrement vide, sans le moindre indice, et
 * l'utilisateur n'a plus qu'à la tuer. Le brouillon étant sauvegardé en continu,
 * un simple rechargement récupère le travail — encore faut-il pouvoir le
 * proposer.
 *
 * Une classe est ici obligatoire : `componentDidCatch` n'a pas d'équivalent en
 * composant de fonction.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[boundary] rendu interrompu :', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <h1 style={styles.title}>L'éditeur s'est interrompu</h1>
          <p style={styles.text}>
            Une erreur inattendue a arrêté l'affichage. Votre travail est
            normalement conservé dans le brouillon automatique : rechargez
            l'application pour le retrouver.
          </p>
          <p style={styles.text}>
            Si le problème se répète à chaque ouverture, enregistrez d'abord une
            copie de votre fichier <code>.shma</code> avant de continuer.
          </p>
          <div style={styles.actions}>
            <button style={styles.primary} onClick={() => window.location.reload()}>
              Recharger l'application
            </button>
          </div>
          <details style={styles.details}>
            <summary style={styles.summary}>Détail technique</summary>
            <pre style={styles.pre}>{error.stack ?? String(error)}</pre>
          </details>
        </div>
      </div>
    )
  }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a2e', color: '#fff', padding: 24,
    fontFamily: 'Inter, system-ui, sans-serif', zIndex: 99999,
  },
  panel: { maxWidth: 560, width: '100%' },
  title: { fontSize: 22, margin: '0 0 16px' },
  text: { lineHeight: 1.6, opacity: 0.85, margin: '0 0 12px' },
  actions: { margin: '20px 0' },
  primary: {
    backgroundColor: '#6c63ff', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer',
  },
  details: { marginTop: 8 },
  summary: { cursor: 'pointer', opacity: 0.6, fontSize: 13 },
  pre: {
    marginTop: 8, padding: 12, borderRadius: 8, fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'auto', maxHeight: 220,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
}
