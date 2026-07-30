import { useState } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'
import type { IconName } from './Icon'
import styles from './Drawer.module.css'

export interface DrawerTab {
  key: string
  label: string
  icon?: IconName
}

interface Props {
  /** Bord de l'éditeur auquel le tiroir est accroché. */
  side: 'left' | 'right'
  tabs: DrawerTab[]
  /** Onglet ouvert, ou `null` si le tiroir est fermé. */
  activeTab: string | null
  onTabChange: (key: string | null) => void
  /** Contenu de l'onglet demandé. Appelé aussi pendant la fermeture. */
  renderTab: (key: string) => ReactNode
  width?: number
}

/**
 * Tiroir latéral repliable.
 *
 * `LeftSidebars` et `SlidePanel` en avaient chacun leur copie : mêmes largeurs,
 * mêmes transitions, mêmes couleurs, mais déjà divergentes (l'un animait son
 * bouton, l'autre avait une classe « ouvert » sans effet). Tout est ici.
 */
export default function Drawer({
  side, tabs, activeTab, onTabChange, renderTab, width = 220,
}: Props) {
  // Onglet à peindre : pendant la fermeture, `activeTab` est déjà `null` alors
  // que le panneau se rétracte encore. On conserve le dernier pour l'estomper
  // au lieu de le faire disparaître d'un coup.
  //
  // Ajustement d'état pendant le rendu (motif React documenté) plutôt qu'une
  // ref : une ref lue pendant le rendu ne provoque pas de nouveau rendu et
  // n'est pas fiable en mode concurrent.
  const [paintedTab, setPaintedTab] = useState(tabs[0]?.key ?? '')
  if (activeTab && activeTab !== paintedTab) setPaintedTab(activeTab)

  const isOpen = activeTab !== null
  const pointsAway = side === 'left' ? !isOpen : isOpen

  return (
    <div className={styles.wrapper} style={{ ['--drawer-width' as string]: `${width}px` }}>
      <div className={`${styles.tabs} ${side === 'left' ? styles.tabsLeft : styles.tabsRight}`}>
        {tabs.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => onTabChange(active ? null : tab.key)}
              aria-expanded={active}
              title={active ? `Fermer ${tab.label}` : `Ouvrir ${tab.label}`}
            >
              <span className={`${styles.chevron} ${pointsAway ? styles.chevronFlipped : ''}`}>
                <Icon name={side === 'left' ? 'chevronRight' : 'chevronLeft'} size={12} />
              </span>
              {tab.icon && (
                <span className={styles.tabIcon}>
                  <Icon name={tab.icon} size={14} />
                </span>
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className={[
          styles.panel,
          isOpen ? styles.panelOpen : '',
          side === 'left' ? styles.panelLeft : styles.panelRight,
        ].join(' ')}
      >
        <div className={`${styles.inner} ${isOpen ? styles.innerVisible : ''}`}>
          {renderTab(paintedTab)}
        </div>
      </div>
    </div>
  )
}

/** Intitulé de section, pour que tous les tiroirs se ressemblent. */
export function DrawerTitle({ children }: { children: ReactNode }) {
  return <p className={styles.title}>{children}</p>
}
