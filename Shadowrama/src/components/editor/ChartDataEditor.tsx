import type { ChartDatum } from '../../types'
import { CHART_PALETTE, MAX_CHART_DATA, datumColor } from '../../utils/chart'
import { nextId } from '../../utils/ids'
import ColorPicker from '../ui/ColorPicker'
import Icon from '../ui/Icon'
import menu from './ContextMenu.module.css'
import styles from './ChartDataEditor.module.css'

interface Props {
  data: ChartDatum[]
  /** Pour afficher la couleur effective d'une donnée sans couleur propre. */
  colorMode?: 'palette' | 'single'
  accentColor?: string
  onChange: (data: ChartDatum[]) => void
}

/** Une ligne par donnée : couleur, nom, valeur. Au moins une ligne reste toujours en place. */
export default function ChartDataEditor({ data, colorMode, accentColor, onChange }: Props) {
  const update = (id: number, changes: Partial<ChartDatum>) =>
    onChange(data.map(d => (d.id === id ? { ...d, ...changes } : d)))

  const add = () => {
    if (data.length >= MAX_CHART_DATA) return
    onChange([...data, { id: nextId(), label: `Donnée ${data.length + 1}`, value: 10 }])
  }

  return (
    <div>
      <div className={styles.list}>
        {data.map((d, i) => (
          <div key={d.id} className={styles.row}>
            <ColorPicker
              value={d.color ?? datumColor({ colorMode, accentColor: accentColor ?? CHART_PALETTE[0] }, d, i)}
              onChange={hex => update(d.id, { color: hex })}
              label={`Couleur de « ${d.label || `donnée ${i + 1}`} »`}
            />
            <input
              type="text"
              className={`${menu.input} ${styles.label}`}
              value={d.label}
              maxLength={60}
              placeholder="Nom"
              aria-label={`Nom de la donnée ${i + 1}`}
              onChange={e => update(d.id, { label: e.target.value })}
            />
            <input
              type="number"
              min={0}
              className={`${menu.input} ${styles.value}`}
              value={d.value}
              aria-label={`Valeur de « ${d.label || `donnée ${i + 1}`} »`}
              onChange={e => {
                const n = Number(e.target.value)
                update(d.id, { value: Number.isFinite(n) && n > 0 ? n : 0 })
              }}
            />
            <button
              type="button"
              className={styles.remove}
              disabled={data.length <= 1}
              aria-label={`Supprimer « ${d.label || `donnée ${i + 1}`} »`}
              onClick={() => onChange(data.filter(x => x.id !== d.id))}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={styles.add} disabled={data.length >= MAX_CHART_DATA} onClick={add}>
        <Icon name="plus" size={14} /> Ajouter une donnée
      </button>
      {data.length >= MAX_CHART_DATA && <div className={styles.hint}>Maximum {MAX_CHART_DATA} données.</div>}
    </div>
  )
}
