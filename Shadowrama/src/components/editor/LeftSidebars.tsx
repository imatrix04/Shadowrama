import { useState } from 'react'
import type { AnimationType, BlockConfig, BlockData, MotionPhase } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import type { DrawerTab } from '../ui/Drawer'
import Icon from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import MotionPanel from './ultra/MotionPanel'
import EffectsPanel from './ultra/EffectsPanel'
import styles from './LeftSidebars.module.css'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
  onSelectAnimation: (type: AnimationType) => void
  /** Nombre de blocs sélectionnés : le panneau Animations en dépend. */
  selectionCount: number
  /** Animation commune à la sélection, pour la marquer comme active. */
  currentAnimation: AnimationType | null
  /** Mode Ultra Design : déverrouille les panneaux Mouvement et Effets. */
  ultra: boolean
  /** Bloc unique sélectionné : les panneaux Ultra travaillent sur un seul bloc. */
  selectedBlock: BlockData | null
  onUpdateSelected: (changes: Partial<BlockData> | ((block: BlockData) => Partial<BlockData>)) => void
  onGestureStart: () => void
  onPreviewMotion: (phase: MotionPhase) => void
}

const ANIMATIONS: { label: string; value: AnimationType; icon: IconName }[] = [
  { label: 'Aucune', value: 'none', icon: 'animNone' },
  { label: 'Fondu', value: 'fadeIn', icon: 'animFade' },
  { label: 'Depuis la gauche', value: 'slideInLeft', icon: 'animSlideLeft' },
  { label: 'Depuis la droite', value: 'slideInRight', icon: 'animSlideRight' },
  { label: 'Depuis le bas', value: 'slideInUp', icon: 'animSlideUp' },
  { label: 'Zoom', value: 'zoomIn', icon: 'animZoom' },
]

const BASE_TABS: DrawerTab[] = [
  { key: 'blocs', label: 'Blocs', icon: 'shape' },
  { key: 'animations', label: 'Animations', icon: 'animFade' },
]

// Les panneaux Ultra s'ajoutent aux onglets existants : le mode est une
// surcouche, pas un éditeur parallèle.
const ULTRA_TABS: DrawerTab[] = [
  { key: 'mouvement', label: 'Mouvement', icon: 'motion' },
  { key: 'effets', label: 'Effets', icon: 'effects' },
]

// Décalage d'apparition, plafonné pour que les listes longues n'attendent pas.
function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 25}ms` }
}

export default function LeftSidebars({
  onAddBlock, onSelectAnimation, selectionCount, currentAnimation,
  ultra, selectedBlock, onUpdateSelected, onGestureStart, onPreviewMotion,
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

  const renderAnimations = () => {
    const hasSelection = selectionCount > 0
    return (
      <>
        <DrawerTitle>Animations d'entrée</DrawerTitle>
        {!hasSelection && (
          <p className={styles.hint}>
            Sélectionnez un bloc sur la diapositive pour lui appliquer une animation.
          </p>
        )}
        <div className={styles.list}>
          {ANIMATIONS.map((anim, i) => {
            const active = hasSelection && currentAnimation === anim.value
            return (
              <button
                key={anim.value}
                className={[
                  styles.item,
                  active ? styles.itemActive : '',
                  hasSelection ? '' : styles.disabled,
                ].join(' ')}
                style={stagger(i)}
                disabled={!hasSelection}
                onClick={() => onSelectAnimation(anim.value)}
                title={
                  hasSelection
                    ? `Appliquer « ${anim.label} » à ${selectionCount} bloc${selectionCount > 1 ? 's' : ''}`
                    : 'Aucun bloc sélectionné'
                }
              >
                <span className={styles.itemIcon}><Icon name={anim.icon} /></span>
                {anim.label}
                {active && <span className={styles.check}>✓</span>}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  const renderTab = (key: string) => {
    if (key === 'blocs') return renderBlocks()
    if (key === 'mouvement') {
      return (
        <>
          <DrawerTitle>Séquences</DrawerTitle>
          <MotionPanel
            block={selectedBlock}
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
          <DrawerTitle>Effets visuels</DrawerTitle>
          <EffectsPanel
            block={selectedBlock}
            onUpdate={onUpdateSelected}
            onGestureStart={onGestureStart}
          />
        </>
      )
    }
    return renderAnimations()
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
