import { useState } from 'react'
import type { BlockConfig, BlockData, MotionPhase } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import type { DrawerTab } from '../ui/Drawer'
import Icon from '../ui/Icon'
import MotionPanel from './ultra/MotionPanel'
import EffectsPanel from './ultra/EffectsPanel'
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
}

// Mouvement fusionne l'ancien panneau Animations : les presets basiques
// restent utilisables sans le mode Ultra, les avancés se débloquent avec.
const BASE_TABS: DrawerTab[] = [
  { key: 'blocs', label: 'Blocs', icon: 'shape' },
  { key: 'mouvement', label: 'Mouvement', icon: 'motion' },
]

// Effets reste entièrement Ultra : pas d'équivalent basique.
const ULTRA_TABS: DrawerTab[] = [
  { key: 'effets', label: 'Effets', icon: 'effects', ultra: true },
]

function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 25}ms` }
}

export default function LeftSidebars({
  onAddBlock, ultra, selectedBlock, onUpdateSelected, onGestureStart, onPreviewMotion,
}: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)

  const renderBlocks = () => (
    <>
      <DrawerTitle>Blocs</DrawerTitle>
      <div className={styles.list}>
        {BLOCKS_CONFIG.map((config, i) => (
          <button
            key={config.type}
            className={styles.item}
            style={stagger(i)}
            onClick={() => onAddBlock({ type: config.type, ...config.defaultProps })}
            title={`Ajouter un bloc ${config.label.toLowerCase()}`}
          >
            <span className={styles.itemIcon}><Icon name={config.icon} /></span>
            {config.label}
          </button>
        ))}
      </div>
    </>
  )

  const renderTab = (key: string) => {
    if (key === 'blocs') return renderBlocks()
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
      tabs={ultra ? [...BASE_TABS, ...ULTRA_TABS] : BASE_TABS}
      activeTab={openPanel}
      onTabChange={setOpenPanel}
      renderTab={renderTab}
      width={240}
    />
  )
}
