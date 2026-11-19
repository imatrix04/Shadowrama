// pages/Settings.tsx
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import SettingRow from '../components/ui/SettingRow'
import Switch from '../components/ui/Switch'
import { useFeatures } from '../hooks/useFeatures'
import { useTheme } from '../hooks/useTheme'
import { PALETTES, type ThemeMode } from '../utils/theme'
import AISetup from '../components/ai/AISetup'
import { useAISettings } from '../ai/useAISettings'
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
 * `locked` (bientôt disponible) ou un interrupteur, pas à réinventer une mise en page.
 *
 * Utilise les tokens `--editor-*` (theme.css), donc réagit déjà au thème —
 * contrairement à Home.tsx, qui a sa propre palette codée en dur et n'est pas
 * câblée sur le thème pour l'instant.
 */
export default function Settings() {
  const navigate = useNavigate()
  const { mode, setMode, palette, setPalette } = useTheme()
  const { features, setFeature } = useFeatures()
  const ai = useAISettings()
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
            <SettingRow title="Thème">
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
            <SettingRow title="Palette" stacked>
              <div className={styles.palettes}>
                {PALETTES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.palette} ${palette === p.id ? styles.paletteActive : ''}`}
                    onClick={() => setPalette(p.id)}
                    aria-pressed={palette === p.id}
                    data-palette-preview={p.id}
                  >
                    <span className={styles.paletteSwatch} />
                    <span className={styles.paletteName}>{p.label}</span>
                  </button>
                ))}
              </div>
            </SettingRow>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Assistant IA</h2>
            <p className={styles.sectionHint}>
              Utilise votre propre clé API. Le contenu des diapositives consultées par l'assistant est
              envoyé au fournisseur choisi : rien ne part sans votre autorisation explicite.
            </p>
            {!ai.available ? (
              <p className={styles.sectionHint}>Disponible dans l'application de bureau.</p>
            ) : ai.settings ? (
              <AISetup
                key={ai.settings.provider}
                settings={ai.settings}
                error={ai.error}
                onSave={ai.save}
                onSetKey={ai.setKey}
                onClearKey={ai.clearKey}
              />
            ) : (
              <p className={styles.sectionHint}>{ai.error ?? 'Chargement…'}</p>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Fonctionnalités</h2>
            <p className={styles.sectionHint}>
              En cours de finition : désactivées par défaut, absentes de l'éditeur tant
              que vous ne les activez pas.
            </p>
            <SettingRow
              title="Outils d'alignement"
              badge="Bêta"
              description="Aligner, centrer et répartir les blocs, depuis un nouveau panneau dans l'éditeur."
            >
              <div className={styles.featureControl}>
                <span className={`${styles.featureState} ${features.alignment ? styles.featureStateOn : ''}`}>
                  {features.alignment ? 'Activé' : 'Désactivé'}
                </span>
                <Switch
                  checked={features.alignment}
                  onChange={checked => setFeature('alignment', checked)}
                  label="Outils d'alignement"
                />
              </div>
            </SettingRow>
          </section>
        </div>
      </div>
    </div>
  )
}