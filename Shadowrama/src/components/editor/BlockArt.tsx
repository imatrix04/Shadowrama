import type { ReactNode } from 'react'
import Icon from '../ui/Icon'
import type { IconName } from '../ui/Icon'

/**
 * Petites illustrations des blocs, pour la palette : on reconnaît un bloc à sa
 * silhouette avant d'avoir lu son nom. Dessinées en `currentColor` (la teinte
 * de la catégorie, posée par le conteneur) avec des opacités étagées.
 */

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

const ART: Record<string, ReactNode> = {
  text: (
    <>
      <rect x="10" y="11" width="52" height="4.5" rx="2.25" fill="currentColor" />
      <rect x="10" y="20" width="60" height="4.5" rx="2.25" fill="currentColor" opacity="0.7" />
      <rect x="10" y="29" width="46" height="4.5" rx="2.25" fill="currentColor" opacity="0.5" />
      <rect x="10" y="38" width="30" height="4.5" rx="2.25" fill="currentColor" opacity="0.3" />
    </>
  ),
  title: (
    <>
      <rect x="10" y="9" width="48" height="11" rx="3" fill="currentColor" />
      <rect x="10" y="26" width="36" height="4.5" rx="2.25" fill="currentColor" opacity="0.5" />
      <rect x="10" y="35" width="24" height="4.5" rx="2.25" fill="currentColor" opacity="0.3" />
    </>
  ),
  shape: (
    <>
      <circle cx="24" cy="30" r="13" fill="currentColor" opacity="0.85" />
      <rect x="34" y="10" width="22" height="22" rx="4" {...STROKE} />
      <path d="M50 44 L62 24 L74 44 Z" fill="currentColor" opacity="0.5" />
    </>
  ),
  image: (
    <>
      <rect x="8" y="8" width="64" height="36" rx="5" {...STROKE} fill="currentColor" fillOpacity="0.1" />
      <circle cx="56" cy="19" r="5" fill="currentColor" />
      <path d="M10 42 L28 24 L40 35 L50 27 L70 42 Z" fill="currentColor" opacity="0.6" />
    </>
  ),
  video: (
    <>
      <rect x="8" y="8" width="64" height="36" rx="5" {...STROKE} fill="currentColor" fillOpacity="0.1" />
      <path d="M34 17 L34 31 L47 24 Z" fill="currentColor" />
      <rect x="14" y="36" width="52" height="2.5" rx="1.25" fill="currentColor" opacity="0.3" />
      <rect x="14" y="36" width="22" height="2.5" rx="1.25" fill="currentColor" />
    </>
  ),
  carousel: (
    <>
      <rect x="3" y="14" width="15" height="22" rx="3" fill="currentColor" opacity="0.25" />
      <rect x="62" y="14" width="15" height="22" rx="3" fill="currentColor" opacity="0.25" />
      <rect x="21" y="7" width="38" height="31" rx="4" {...STROKE} fill="currentColor" fillOpacity="0.15" />
      <path d="M23 36 L34 24 L42 31 L48 26 L57 36 Z" fill="currentColor" opacity="0.6" />
      <circle cx="34" cy="46" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="46" r="2.4" fill="currentColor" />
      <circle cx="46" cy="46" r="2" fill="currentColor" opacity="0.35" />
    </>
  ),
  chart: (
    <>
      <rect x="11" y="27" width="11" height="17" rx="2.5" fill="currentColor" opacity="0.45" />
      <rect x="26" y="15" width="11" height="29" rx="2.5" fill="currentColor" opacity="0.7" />
      <rect x="41" y="22" width="11" height="22" rx="2.5" fill="currentColor" opacity="0.55" />
      <rect x="56" y="8" width="11" height="36" rx="2.5" fill="currentColor" />
      <path d="M6 46 H74" {...STROKE} strokeWidth="1.5" opacity="0.4" />
    </>
  ),
  table: (
    <>
      <rect x="8" y="8" width="64" height="36" rx="4" {...STROKE} strokeWidth="1.8" />
      <path d="M8 12 a4 4 0 0 1 4 -4 H68 a4 4 0 0 1 4 4 V17 H8 Z" fill="currentColor" />
      <path d="M8 26 H72 M8 35 H72 M29 8 V44 M50 8 V44" {...STROKE} strokeWidth="1.4" opacity="0.55" />
    </>
  ),
  webview: (
    <>
      <rect x="6" y="6" width="68" height="40" rx="5" {...STROKE} strokeWidth="1.8" />
      <path d="M6 16 H74" {...STROKE} strokeWidth="1.4" opacity="0.5" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="11" r="1.6" fill="currentColor" opacity="0.7" />
      <circle cx="23" cy="11" r="1.6" fill="currentColor" opacity="0.45" />
      <rect x="30" y="8.5" width="38" height="5" rx="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="31" r="9" {...STROKE} strokeWidth="1.6" />
      <ellipse cx="40" cy="31" rx="4" ry="9" {...STROKE} strokeWidth="1.4" opacity="0.6" />
      <path d="M31 31 H49" {...STROKE} strokeWidth="1.4" opacity="0.6" />
    </>
  ),
}

export default function BlockArt({ type, icon }: { type: string; icon: IconName }) {
  const art = ART[type]
  if (!art) return <Icon name={icon} size={28} />
  return (
    <svg viewBox="0 0 80 52" width="100%" height="100%" aria-hidden="true" focusable="false">
      {art}
    </svg>
  )
}
