import type { Features } from '../../hooks/useFeatures'
import { useState } from 'react'
import type { BlockConfig, BlockData, MotionPhase } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import type { DrawerTab } from '../ui/Drawer'
import BlockArt from './BlockArt'
import { BLOCK_CATEGORIES, blockMeta, matchesBlock } from './blockCatalog'
import MotionPanel from './ultra/MotionPanel'
import EffectsPanel from './ultra/EffectsPanel'
import AlignPanel from './AlignPanel'
import type { BlockUpdate } from '../../utils/blockUpdates'
import styles from './LeftSidebars.module.css'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
  /** Mode Ultra Design : déverrouille les mouvements avancés et le panneau Effets. */
  ultra: boolean
  /** Bloc unique sélectionné : Mouvement et Effets travaillent sur un seul bloc. */
  selectedBlock: BlockData | null
  onUpdateSelected: (changes: Partial<BlockData> | ((block: BlockData) => Partial<BlockData>)) => void
  onGestureStart: () => void
  onPreviewMotion: (phase: MotionPhase) => void
  /** Tous les blocs sélectionnés (Alignement travaille sur plusieurs blocs). */
  selectedBlocks: BlockData[]
  /** Fonctionnalité Alignement déverrouillée dans les Paramètres. */
  alignmentEnabled: boolean
  /** Fonctionnalités bêta déverrouillées : filtrent les blocs de la palette. */
  features: Features
  /** Lot atomique : une seule entrée d'historique pour tout l'alignement. */
  onCommitBlocks: (updates: BlockUpdate[]) => void
}

// Mouvement fusionne l'ancien panneau Animations : les presets basiques
// restent utilisables sans le mode Ultra, les avancés se débloquent avec.
const BASE_TABS: DrawerTab[] = [
  { key: 'blocs', label: 'Blocs', icon: 'shape' },
  { key: 'mouvement', label: 'Mouvement', icon: 'motion' },
]

// Verrouillé par défaut : n'existe dans le rail qu'une fois déverrouillé dans
// Paramètres → Fonctionnalités (voir useFeatures).
const ALIGNMENT_TAB: DrawerTab = { key: 'alignement', label: 'Alignement', icon: 'align' }

// Effets reste entièrement Ultra : pas d'équivalent basique.
const ULTRA_TABS: DrawerTab[] = [
  { key: 'effets', label: 'Effets', icon: 'effects', ultra: true },
]

function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 25}ms` }
}

export default function LeftSidebars({
  onAddBlock, ultra, selectedBlock, onUpdateSelected, onGestureStart, onPreviewMotion,
  selectedBlocks, onCommitBlocks, alignmentEnabled, features,
}: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Alignement s'insère après Blocs ; les onglets Ultra restent en dernier.
  const tabs = [
    BASE_TABS[0],
    ...(alignmentEnabled ? [ALIGNMENT_TAB] : []),
    ...BASE_TABS.slice(1),
    ...(ultra ? ULTRA_TABS : []),
  ]
  // Un panneau ouvert dont l'onglet a disparu ne doit pas rester affiché.
  const activePanel = openPanel && tabs.some(tab => tab.key === openPanel) ? openPanel : null

  const renderBlocks = () => {
    const available = BLOCKS_CONFIG.filter(
      config => (!config.ultraOnly || ultra) && (!config.beta || features[config.beta]),
    )
    const shown = available.filter(config => matchesBlock(config.label, config.type, query))
    const add = (config: BlockConfig) => onAddBlock({ type: config.type, ...config.defaultProps })

    // Les catégories vides (rien ne correspond à la recherche) disparaissent.
    const groups = BLOCK_CATEGORIES
      .map(cat => ({ cat, items: shown.filter(c => blockMeta(c.type).category === cat.id) }))
      .filter(g => g.items.length > 0)

    let cardIndex = 0
    return (
      <>
        <DrawerTitle>Blocs</DrawerTitle>
        <label className={styles.search}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            placeholder="Rechercher un bloc…"
            aria-label="Rechercher un bloc"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && shown[0]) { add(shown[0]); setQuery('') }
              if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery('') }
            }}
          />
        </label>

        {groups.map(({ cat, items }) => (
          <section key={cat.id} className={styles.group} style={{ '--hue': cat.hue } as React.CSSProperties}>
            <h3 className={styles.groupTitle}>{cat.label}</h3>
            <div className={styles.grid}>
              {items.map(config => (
                <button
                  key={config.type}
                  type="button"
                  className={`${styles.card} ${config.ultraOnly ? styles.cardUltra : ''}`}
                  style={stagger(cardIndex++)}
                  onClick={() => add(config)}
                  title={`Ajouter un bloc ${config.label.toLowerCase()}`}
                >
                  <span className={styles.art}><BlockArt type={config.type} icon={config.icon} /></span>
                  <span className={styles.cardLabel}>{config.label}</span>
                  <span className={styles.cardTagline}>{blockMeta(config.type).tagline}</span>
                  <span className={styles.plus} aria-hidden="true">+</span>
                  {config.ultraOnly && <span className={styles.ultraBadge}>Ultra</span>}
                  {config.beta && <span className={styles.betaBadge}>Bêta</span>}
                </button>
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <p className={styles.empty}>Aucun bloc ne correspond à « {query} ».</p>
        )}
      </>
    )
  }

  const renderTab = (key: string) => {
    if (key === 'blocs') return renderBlocks()
    if (key === 'alignement' && alignmentEnabled) {
      return (
        <>
          <DrawerTitle>Alignement</DrawerTitle>
          <AlignPanel blocks={selectedBlocks} onCommit={onCommitBlocks} />
        </>
      )
    }
    if (key === 'mouvement') {
      return (
        <>
          <DrawerTitle>Mouvement</DrawerTitle>
          <MotionPanel
            block={selectedBlock}
            ultra={ultra}
            onUpdate={onUpdateSelected}
            onGestureStart={onGestureStart}
            onPreview={onPreviewMotion}
          />
        </>
      )
    }
    if (key === 'effets') {
      return (
        <>
          <DrawerTitle ultra>Effets visuels</DrawerTitle>
          <EffectsPanel
            block={selectedBlock}
            onUpdate={onUpdateSelected}
            onGestureStart={onGestureStart}
          />
        </>
      )
    }
    return null
  }
  return (
    <Drawer
      side="left"
      tabs={tabs}
      activeTab={activePanel}
      onTabChange={setOpenPanel}
      renderTab={renderTab}
      width={240}
    />
  )
}
