import type { CSSProperties } from 'react'
import Icon from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'

interface Props {
  icon: IconName
  label: string
  borderRadius?: number
  className?: string
  style?: CSSProperties
}

/** Emplacement vide d'un bloc à média (image, vidéo) : cadre en pointillés. */
export default function MediaPlaceholder({ icon, label, borderRadius, className, style }: Props) {
  return (
    <div className={className} style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.35rem',
      backgroundColor: 'var(--editor-bg-canvas)',
      color: 'var(--editor-text-muted)',
      border: '2px dashed var(--editor-border-light)',
      borderRadius: `${borderRadius ?? 4}px`,
      fontSize: '0.8rem',
      textAlign: 'center',
      userSelect: 'none',
      ...style,
    }}>
      <Icon name={icon} size={22} />
      {label}
    </div>
  )
}