import { useState } from 'react'
import type { BlockConfig, BlockData, MotionPhase } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import type { DrawerTab } from '../ui/Drawer'
import Icon from '../ui/Icon'
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
  selectedBlocks, onCommitBlocks, alignmentEnabled,
}: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)

  // Alignement s'insère après Blocs ; les onglets Ultra restent en dernier.
  const tabs = [
    BASE_TABS[0],
    ...(alignmentEnabled ? [ALIGNMENT_TAB] : []),
    ...BASE_TABS.slice(1),
    ...(ultra ? ULTRA_TABS : []),
  ]
  // Un panneau ouvert dont l'onglet a disparu ne doit pas rester affiché.
  const activePanel = openPanel && tabs.some(tab => tab.key === openPanel) ? openPanel : null

  const renderBlocks = () => (
    <>
      <DrawerTitle>Blocs</DrawerTitle>
      <div className={styles.list}>
          {BLOCKS_CONFIG.filter(config => !config.ultraOnly || ultra).map((config, i) => (
          <button
            key={config.type}
            className={`${styles.item} ${config.ultraOnly ? styles.itemUltra : ''}`}
            style={stagger(i)}
            onClick={() => onAddBlock({ type: config.type, ...config.defaultProps })}
            title={`Ajouter un bloc ${config.label.toLowerCase()}`}
          >
            <span className={styles.itemIcon}><Icon name={config.icon} /></span>
            {config.label}
            {config.ultraOnly && <span className={styles.ultraBadge}>Ultra</span>}
          </button>
        ))}
      </div>
    </>
  )

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
