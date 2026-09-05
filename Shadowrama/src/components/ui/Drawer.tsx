import { useState } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'
import type { IconName } from './Icon'
import styles from './Drawer.module.css'

export interface DrawerTab {
  key: string
  label: string
  icon?: IconName
  ultra?: boolean
}

interface Props {
  side: 'left' | 'right'
  tabs: DrawerTab[]
  activeTab: string | null
  onTabChange: (key: string | null) => void
  renderTab: (key: string) => ReactNode
  width?: number
}

export default function Drawer({
  side, tabs, activeTab, onTabChange, renderTab, width = 220,
}: Props) {
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
              className={[
                styles.tab,
                tab.ultra ? styles.tabUltra : '',
                active ? styles.tabActive : '',
              ].join(' ')}
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
export function DrawerTitle({ children, ultra }: { children: ReactNode; ultra?: boolean }) {
  return <p className={`${styles.title} ${ultra ? styles.titleUltra : ''}`}>{children}</p>
}
