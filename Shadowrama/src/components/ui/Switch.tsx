// components/ui/Switch.tsx
import styles from './Switch.module.css'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Libellé accessible : le contrôle n'a pas de texte visible à côté de lui. */
  label?: string
}

export default function Switch({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.switch} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}