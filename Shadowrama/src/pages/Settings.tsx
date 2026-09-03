// pages/Settings.tsx
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import SettingRow from '../components/ui/SettingRow'
import { useTheme } from '../hooks/useTheme'
import type { ThemeMode } from '../utils/theme'
import styles from './Settings.module.css'

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: 'moon' | 'sun' | 'monitor' }[] = [
  { mode: 'dark', label: 'Sombre', icon: 'moon' },
  { mode: 'light', label: 'Clair', icon: 'sun' },
  { mode: 'system', label: 'Système', icon: 'monitor' },
]

/**
 * Page de paramètres. Volontairement structurée en sections + `SettingRow`
 * dès maintenant : les prochaines fonctionnalités livrées verrouillées
 * (nouveaux types de blocs, etc.) n'auront qu'à ajouter une ligne avec
 * `locked`, pas à réinventer une mise en page.
 *
 * Utilise les tokens `--editor-*` (theme.css), donc réagit déjà au thème —
 * contrairement à Home.tsx, qui a sa propre palette codée en dur et n'est pas
 * câblée sur le thème pour l'instant.
 */
export default function Settings() {
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()
  const activeIndex = THEME_OPTIONS.findIndex(opt => opt.mode === mode)

  return (
    <div className={styles.page}>
      {/* Fond décoratif : deux halos qui dérivent très lentement — écho discret
          du positionnement du produit (« des présentations qui bougent »),
          plutôt qu'un fond statique. Purement décoratif, masqué aux lecteurs
          d'écran. */}
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>

      <nav className={styles.nav}>
        <button className={styles.back} onClick={() => navigate(-1)}>
          <Icon name="chevronLeft" size={18} />
          Retour
        </button>
      </nav>

      <div className={styles.content}>
        <div className={styles.panel}>
          <h1 className={styles.pageTitle}>Paramètres</h1>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Apparence</h2>
            <SettingRow
              title="Thème"
              description="S'applique à l'interface de création. « Système » suit le réglage de votre ordinateur et se met à jour automatiquement."
            >
              <div
                className={styles.segmented}
                style={{ '--active-index': activeIndex } as CSSProperties}
              >
                <span className={styles.segmentIndicator} />
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.mode}
                    type="button"
                    className={`${styles.segment} ${mode === opt.mode ? styles.segmentActive : ''}`}
                    // L'origine du clic alimente le cercle de la transition de
                    // thème (voir useTheme / applyThemeWithTransition) : le
                    // changement démarre visuellement depuis le bouton pressé.
                    onClick={e => setMode(opt.mode, { x: e.clientX, y: e.clientY })}
                    aria-pressed={mode === opt.mode}
                  >
                    <Icon
                      name={opt.icon}
                      size={15}
                      className={mode === opt.mode ? styles.segmentIcon : undefined}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Fonctionnalités</h2>
            <p className={styles.sectionHint}>
              Les prochains types de blocs (vidéo, graphique, carrousel animé) arriveront ici,
              verrouillés par défaut jusqu'à leur sortie officielle.
            </p>
            <SettingRow
              title="Blocs vidéo, graphique et carrousel"
              description="Nouveaux types de blocs, en cours de développement."
              locked
            />
          </section>
        </div>
      </div>
    </div>
  )
}