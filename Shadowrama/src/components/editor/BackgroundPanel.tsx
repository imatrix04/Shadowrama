import type { ParticleSettings, SlideBackground } from '../../types'
import { GRADIENT_PRESETS, DEFAULT_GRADIENT } from '../../ultra/slideBackground'
import {
  DEFAULT_PARTICLES,
  PARTICLE_MOTIONS,
  PARTICLE_MOUSE_MODES,
  PARTICLE_PRESETS,
  PARTICLE_SHAPES,
  mergeParticles,
} from '../../ultra/particles'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import ColorPicker from '../ui/ColorPicker'
import styles from './PanelControls.module.css'
import { Section, Segmented, SwitchRow } from './PanelWidgets'

interface Props {
  slideIndex: number
  current: SlideBackground | undefined
  /** Dégradé, image et particules ne sont proposés qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (background: SlideBackground | undefined) => void
}

const TYPE_OPTIONS: { value: SlideBackground['type']; label: string; ultraOnly: boolean }[] = [
  { value: 'color', label: 'Unie', ultraOnly: false },
  { value: 'gradient', label: 'Dégradé', ultraOnly: true },
  { value: 'image', label: 'Image', ultraOnly: true },
]

const MAX_COLORS = 4

function Slider({ label, value, min, max, step, display, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div className={styles.fieldStacked}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.rangeGroup}>
        <input
          type="range"
          className={styles.range}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <span className={styles.rangeValue}>{display}</span>
      </div>
    </div>
  )
}

export default function BackgroundPanel({ slideIndex, current, ultra, onChange }: Props) {
  const hiddenUltra = !ultra && current && current.type !== 'color'
  const particlesOn = !!current?.particles?.enabled
  // Valeurs affichées : un projet antérieur à la 0.19 n'a aucun champ, les
  // curseurs doivent malgré tout partir d'un réglage cohérent.
  const p = mergeParticles(current?.particles)

  const setType = (type: SlideBackground['type']) => {
    if (type === 'color') {
      onChange({ type: 'color', color: current?.color ?? '#faf6ec', particles: current?.particles })
    } else if (type === 'gradient') {
      onChange({
        type: 'gradient',
        gradient: current?.gradient ?? { from: DEFAULT_GRADIENT.from, to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle },
        animated: current?.animated ?? false,
        overlay: current?.overlay,
        particles: current?.particles,
      })
    } else {
      onChange({
        type: 'image',
        image: current?.image,
        imageFit: current?.imageFit ?? 'cover',
        overlay: current?.overlay,
        particles: current?.particles,
      })
    }
  }

  const setOverlay = (changes: Partial<{ color: string; opacity: number }>) => {
    if (!current) return
    const overlay = { color: current.overlay?.color ?? '#000000', opacity: current.overlay?.opacity ?? 0.35, ...changes }
    onChange({ ...current, overlay })
  }

  /** Les particules sont indépendantes du type de fond : les activer sur une
   *  diapositive vierge crée au passage un fond uni, sans quoi il n'y aurait
   *  aucun objet `SlideBackground` où les ranger. */
  const setParticles = (changes: Partial<ParticleSettings>) => {
    const base = current ?? { type: 'color' as const, color: '#1a1a2e' }
    onChange({ ...base, particles: mergeParticles({ ...p, ...changes }) })
  }

  const applyPreset = (settings: ParticleSettings) => {
    const base = current ?? { type: 'color' as const, color: '#1a1a2e' }
    onChange({ ...base, particles: { ...settings, enabled: true } })
  }

  const setColorAt = (index: number, value: string) => {
    const colors = [...p.colors]
    colors[index] = value
    setParticles({ colors })
  }

  const previewSrc = current?.type === 'image' && current.image
    ? (current.image.startsWith('media/') ? resolveMedia(current.image) : current.image)
    : undefined

  return (
    <>
      <p className={styles.groupLabel}>
        Diapositive {slideIndex + 1}
        {current && (
          <button className={styles.remove} onClick={() => onChange(undefined)}>
            retirer
          </button>
        )}
      </p>

      {hiddenUltra && (
        <p className={styles.hint}>
          « {current?.type === 'gradient' ? 'Dégradé' : 'Image'} » est un réglage Ultra : il est
          conservé mais reste inactif tant que le mode Ultra Design est coupé.
        </p>
      )}

      <Segmented
        options={TYPE_OPTIONS
          .filter(t => !t.ultraOnly || ultra || current?.type === t.value)
          .map(t => ({ value: t.value, label: t.label }))}
        value={current?.type}
        onChange={setType}
      />

      {current?.type === 'color' && (
        <div className={styles.group}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <ColorPicker value={current.color ?? '#faf6ec'} onChange={v => onChange({ ...current, color: v })} />
          </div>
        </div>
      )}

      {current?.type === 'gradient' && (
        <div className={styles.group}>
          <div className={styles.presetList}>
            {GRADIENT_PRESETS.map(preset => {
              const active = current.gradient?.from === preset.from && current.gradient?.to === preset.to
              return (
                <button
                  key={preset.label}
                  className={`${styles.preset} ${active ? styles.presetActive : ''}`}
                  onClick={() => onChange({ ...current, gradient: { from: preset.from, to: preset.to, angle: preset.angle } })}
                  style={{ backgroundImage: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`, color: '#fff' }}
                >
                  <span className={styles.presetName}>{preset.label}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Départ</span>
            <ColorPicker value={current.gradient?.from ?? DEFAULT_GRADIENT.from} onChange={v => onChange({ ...current, gradient: { ...current.gradient!, from: v } })} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Arrivée</span>
            <ColorPicker value={current.gradient?.to ?? DEFAULT_GRADIENT.to} onChange={v => onChange({ ...current, gradient: { ...current.gradient!, to: v } })} />
          </div>
          <Slider
            label="Angle" min={0} max={360} step={15}
            value={current.gradient?.angle ?? DEFAULT_GRADIENT.angle}
            display={`${current.gradient?.angle ?? DEFAULT_GRADIENT.angle}°`}
            onChange={v => onChange({ ...current, gradient: { ...current.gradient!, angle: v } })}
          />
          <SwitchRow
            label="Dégradé animé"
            checked={!!current.animated}
            onChange={animated => onChange({ ...current, animated })}
          />
        </div>
      )}

      {current?.type === 'image' && (
        <div className={styles.group}>
          {previewSrc && <img src={previewSrc} className={styles.preview} alt="" />}
          <label className={styles.dropzone}>
            {previewSrc ? "Changer l'image" : 'Choisir une image…'}
            <input
              type="file"
              accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const bytes = new Uint8Array(await file.arrayBuffer())
                const key = generateMediaKey(file.name)
                registerMedia(key, bytes, file.type)
                onChange({ ...current, image: key })
              }}
            />
          </label>
          <Segmented
            options={[
              { value: 'cover' as const, label: 'Recouvrante' },
              { value: 'contain' as const, label: 'Ajustée' },
            ]}
            value={current.imageFit ?? 'cover'}
            onChange={imageFit => onChange({ ...current, imageFit })}
          />
        </div>
      )}

      {current && current.type !== 'color' && (
        <Section title="Superposition">
          <p className={styles.subtle}>
            Assombrit ou éclaircit le fond pour garder le texte lisible.
          </p>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <ColorPicker value={current.overlay?.color ?? '#000000'} onChange={v => setOverlay({ color: v })} />
          </div>
          <Slider
            label="Intensité" min={0} max={0.9} step={0.05}
            value={current.overlay?.opacity ?? 0}
            display={`${Math.round((current.overlay?.opacity ?? 0) * 100)}%`}
            onChange={v => setOverlay({ opacity: v })}
          />
        </Section>
      )}

      {/* ── Particules ──────────────────────────────────────────────────── */}

      {(ultra || particlesOn) && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Particules</p>

          {!ultra && particlesOn && (
            <p className={styles.hint}>
              Les particules sont un réglage Ultra : elles sont conservées mais ne s'affichent
              pas tant que le mode Ultra Design est coupé.
            </p>
          )}

          <SwitchRow
            label="Activer les particules"
            checked={particlesOn}
            onChange={enabled => setParticles({ enabled })}
          />
        </div>
      )}

      {ultra && particlesOn && (
        <>
          <Section title="Ambiances" defaultOpen>
            <div className={styles.presetList}>
              {PARTICLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={styles.preset}
                  onClick={() => applyPreset(preset.settings)}
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${preset.settings.colors[0]}, ${preset.settings.colors[preset.settings.colors.length - 1]})`,
                    color: '#fff',
                  }}
                >
                  <span className={styles.presetName}>{preset.label}</span>
                </button>
              ))}
            </div>
            <p className={styles.subtle}>
              Une ambiance remplace tous les réglages ci-dessous — à ajuster ensuite librement.
            </p>
          </Section>

          <Section title="Style et animation" defaultOpen>
            <Segmented
              options={PARTICLE_SHAPES.map(s => ({ value: s.value, label: s.label }))}
              value={p.shape}
              onChange={shape => setParticles({ shape })}
            />
            <Segmented
              options={PARTICLE_MOTIONS.map(m => ({ value: m.value, label: m.label }))}
              value={p.motion}
              onChange={motion => setParticles({ motion })}
            />
            {p.motion === 'stream' && (
              <Slider
                label="Direction du flux" min={0} max={360} step={5}
                value={p.direction} display={`${p.direction}°`}
                onChange={v => setParticles({ direction: v })}
              />
            )}
          </Section>

          <Section title="Réglages">
            <Slider label="Quantité" min={5} max={400} step={5} value={p.count} display={`${p.count}`}
              onChange={v => setParticles({ count: v })} />
            <Slider label="Vitesse" min={0.1} max={3} step={0.1} value={p.speed} display={`${p.speed.toFixed(1)}×`}
              onChange={v => setParticles({ speed: v })} />
            <Slider label="Taille" min={1} max={24} step={0.5} value={p.size} display={`${p.size}px`}
              onChange={v => setParticles({ size: v })} />
            <Slider label="Variation de taille" min={0} max={1} step={0.05} value={p.sizeVariation}
              display={`${Math.round(p.sizeVariation * 100)}%`}
              onChange={v => setParticles({ sizeVariation: v })} />
            <Slider label="Opacité" min={0.05} max={1} step={0.05} value={p.opacity}
              display={`${Math.round(p.opacity * 100)}%`}
              onChange={v => setParticles({ opacity: v })} />
            <Slider label="Halo" min={0} max={30} step={1} value={p.glow} display={`${p.glow}px`}
              onChange={v => setParticles({ glow: v })} />
          </Section>

          <Section title="Couleurs et rendu">
            {p.colors.map((color, i) => (
              <div className={styles.field} key={i}>
                <span className={styles.fieldLabel}>Couleur {i + 1}</span>
                <ColorPicker value={color} onChange={v => setColorAt(i, v)} />
                {p.colors.length > 1 && (
                  <button
                    className={styles.remove}
                    onClick={() => setParticles({ colors: p.colors.filter((_, j) => j !== i) })}
                  >
                    retirer
                  </button>
                )}
              </div>
            ))}
            {p.colors.length < MAX_COLORS && (
              <button
                className={styles.toggle}
                onClick={() => setParticles({ colors: [...p.colors, DEFAULT_PARTICLES.colors[0]] })}
              >
                ＋ Ajouter une couleur
              </button>
            )}
            <div style={{ marginTop: '0.5rem' }}>
              <SwitchRow label="Fusion additive" checked={p.additive} onChange={additive => setParticles({ additive })} />
              <SwitchRow label="Scintillement" checked={p.twinkle} onChange={twinkle => setParticles({ twinkle })} />
              <SwitchRow label="Rotation des formes" checked={p.rotate} onChange={rotate => setParticles({ rotate })} />
            </div>
          </Section>

          <Section title="Liens">
            <p className={styles.subtle}>
              Relie les particules proches par un trait — l'effet « constellation ».
              Au-delà de 220 particules, les liens sont ignorés pour préserver la fluidité.
            </p>
            <SwitchRow
              label="Activer les liens"
              checked={p.links.enabled}
              onChange={enabled => setParticles({ links: { ...p.links, enabled } })}
            />
            {p.links.enabled && (
              <>
                <Slider label="Portée" min={30} max={300} step={10} value={p.links.distance}
                  display={`${p.links.distance}px`}
                  onChange={v => setParticles({ links: { ...p.links, distance: v } })} />
                <Slider label="Épaisseur" min={0.5} max={4} step={0.5} value={p.links.width}
                  display={`${p.links.width}px`}
                  onChange={v => setParticles({ links: { ...p.links, width: v } })} />
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Couleur des liens</span>
                  <ColorPicker value={p.links.color ?? p.colors[0]} onChange={v => setParticles({ links: { ...p.links, color: v } })} />
                  {p.links.color && (
                    <button
                      className={styles.remove}
                      onClick={() => setParticles({ links: { ...p.links, color: undefined } })}
                    >
                      auto
                    </button>
                  )}
                </div>
              </>
            )}
          </Section>

          <Section title="Réaction à la souris">
            <Segmented
              options={PARTICLE_MOUSE_MODES.map(m => ({ value: m.value, label: m.label }))}
              value={p.mouse.mode}
              onChange={mode => setParticles({ mouse: { ...p.mouse, mode } })}
            />
            {p.mouse.mode !== 'none' && (
              <>
                <Slider label="Rayon d'influence" min={40} max={400} step={10} value={p.mouse.radius}
                  display={`${p.mouse.radius}px`}
                  onChange={v => setParticles({ mouse: { ...p.mouse, radius: v } })} />
                <Slider label="Force" min={0.1} max={2} step={0.1} value={p.mouse.strength}
                  display={`${p.mouse.strength.toFixed(1)}×`}
                  onChange={v => setParticles({ mouse: { ...p.mouse, strength: v } })} />
              </>
            )}
          </Section>
        </>
      )}
    </>
  )
}
