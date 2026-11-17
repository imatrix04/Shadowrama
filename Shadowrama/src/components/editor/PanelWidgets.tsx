import type { ReactNode } from 'react'
import Switch from '../ui/Switch'
import styles from './PanelControls.module.css'

/** Choix exclusif sur une seule ligne (3-4 options courtes). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${styles.segment} ${value === o.value ? styles.segmentActive : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Libellé à gauche, interrupteur à droite. */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

/** Section repliable (fermée par défaut) : évite le long défilement. */
export function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary className={styles.sectionTitle}>{title}</summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  )
}
