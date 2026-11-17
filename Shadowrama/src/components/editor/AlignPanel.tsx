import { useState } from 'react'
import type { BlockData } from '../../types'
import type { BlockUpdate } from '../../utils/blockUpdates'
import { alignBlocks, distributeBlocks } from '../../utils/alignment'
import type { AlignMode, AlignReference } from '../../utils/alignment'
import { Segmented } from './PanelWidgets'
import controls from './PanelControls.module.css'
import styles from './AlignPanel.module.css'

interface Props {
  /** Blocs sélectionnés sur la diapositive affichée. */
  blocks: BlockData[]
  /** Applique un lot en une seule entrée d'historique (un Ctrl+Z annule tout). */
  onCommit: (updates: BlockUpdate[]) => void
}

/** Pictogrammes : une règle et deux barres de longueurs différentes. */
const GLYPHS: Record<string, React.ReactNode> = {
  left: <><path d="M4 4v16" /><rect x="8" y="6" width="12" height="4" rx="1" /><rect x="8" y="14" width="7" height="4" rx="1" /></>,
  centerX: <><path d="M12 3v18" /><rect x="5" y="6" width="14" height="4" rx="1" /><rect x="8" y="14" width="8" height="4" rx="1" /></>,
  right: <><path d="M20 4v16" /><rect x="4" y="6" width="12" height="4" rx="1" /><rect x="9" y="14" width="7" height="4" rx="1" /></>,
  top: <><path d="M4 4h16" /><rect x="6" y="8" width="4" height="12" rx="1" /><rect x="14" y="8" width="4" height="7" rx="1" /></>,
  centerY: <><path d="M3 12h18" /><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="8" width="4" height="8" rx="1" /></>,
  bottom: <><path d="M4 20h16" /><rect x="6" y="4" width="4" height="12" rx="1" /><rect x="14" y="9" width="4" height="7" rx="1" /></>,
  distributeX: <><path d="M4 4v16M20 4v16" /><rect x="9" y="7" width="6" height="10" rx="1" /></>,
  distributeY: <><path d="M4 4h16M4 20h16" /><rect x="7" y="9" width="10" height="6" rx="1" /></>,
}

function Glyph({ name }: { name: string }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  )
}

const ALIGN_ACTIONS: { mode: AlignMode; label: string }[] = [
  { mode: 'left', label: 'Aligner à gauche' },
  { mode: 'centerX', label: 'Centrer horizontalement' },
  { mode: 'right', label: 'Aligner à droite' },
  { mode: 'top', label: 'Aligner en haut' },
  { mode: 'centerY', label: 'Centrer verticalement' },
  { mode: 'bottom', label: 'Aligner en bas' },
]

export default function AlignPanel({ blocks, onCommit }: Props) {
  const [reference, setReference] = useState<AlignReference>('selection')
  const count = blocks.length

  if (count === 0) {
    return (
      <p className={controls.subtle}>
        Sélectionne un bloc pour le centrer ou l'aligner sur la diapositive, ou
        plusieurs blocs (Maj + clic, ou glisser un rectangle) pour les aligner entre eux.
      </p>
    )
  }

  // Un seul bloc n'a que la diapositive comme repère.
  const effectiveReference: AlignReference = count === 1 ? 'slide' : reference

  return (
    <>
      <div className={controls.group}>
        <p className={controls.groupLabel}>Aligner</p>
        {count > 1 && (
          <Segmented
            options={[
              { value: 'selection' as const, label: 'Sur la sélection' },
              { value: 'slide' as const, label: 'Sur la diapo' },
            ]}
            value={reference}
            onChange={setReference}
          />
        )}
        {count === 1 && <p className={controls.subtle}>Aligné sur la diapositive.</p>}
        <div className={styles.grid}>
          {ALIGN_ACTIONS.map(a => (
            <button
              key={a.mode}
              type="button"
              className={styles.btn}
              title={a.label}
              aria-label={a.label}
              onClick={() => onCommit(alignBlocks(blocks, a.mode, effectiveReference))}
            >
              <Glyph name={a.mode} />
            </button>
          ))}
        </div>
      </div>

      <div className={controls.group}>
        <p className={controls.groupLabel}>Répartir</p>
        <div className={styles.grid}>
          <button
            type="button"
            className={styles.btn}
            title="Répartir horizontalement"
            aria-label="Répartir horizontalement"
            disabled={count < 3}
            onClick={() => onCommit(distributeBlocks(blocks, 'x'))}
          >
            <Glyph name="distributeX" />
          </button>
          <button
            type="button"
            className={styles.btn}
            title="Répartir verticalement"
            aria-label="Répartir verticalement"
            disabled={count < 3}
            onClick={() => onCommit(distributeBlocks(blocks, 'y'))}
          >
            <Glyph name="distributeY" />
          </button>
        </div>
        {count < 3 && (
          <p className={controls.subtle}>Il faut au moins trois blocs sélectionnés.</p>
        )}
      </div>

      <p className={controls.subtle}>
        Au glissé, les blocs s'aimantent aux bords et aux centres des autres.
        Maintiens <strong>Alt</strong> pour placer sans magnétisme.
      </p>
    </>
  )
}
