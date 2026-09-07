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
import styles from './PanelControls.module.css'

interface Props {
  slideIndex: number
  current: SlideBackground | undefined
  /** Dégradé, image et particules ne sont proposés qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (background: SlideBackground | undefined) => void
}

const TYPE_OPTIONS: { value: SlideBackground['type']; label: string; ultraOnly: boolean }[] = [
  { value: 'color', label: 'Couleur unie', ultraOnly: false },
  { value: 'gradient', label: 'Dégradé', ultraOnly: true },
  { value: 'image', label: 'Image', ultraOnly: true },
]

const MAX_COLORS = 4

export default function BackgroundPanel({ slideIndex, current, ultra, onChange }: Props) {
  const hiddenUltra = !ultra && current && current.type !== 'color'
  const particlesOn = !!current?.particles?.enabled
  // Valeurs affichées : un projet antérieur à la 0.19 n'a aucun champ, les
  // curseurs doivent malgré tout partir d'un réglage cohérent.
  const p = mergeParticles(current?.particles)

  const setType = (type: SlideBackground['type']) => {
    if (type === 'color') {
      onChange({ type: 'color', color: current?.color ?? '#1a1a2e', particles: current?.particles })
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

      <div className={styles.group}>
        <div className={styles.presetList}>
          {TYPE_OPTIONS.filter(t => !t.ultraOnly || ultra || current?.type === t.value).map(t => (
            <button
              key={t.value}
              className={`${styles.preset} ${current?.type === t.value ? styles.presetActive : ''}`}
              onClick={() => setType(t.value)}
            >
              <span className={styles.presetName}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {current?.type === 'color' && (
        <div className={styles.group}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <input
              type="color"
              className={styles.color}
              value={current.color ?? '#1a1a2e'}
              onChange={e => onChange({ ...current, color: e.target.value })}
            />
          </div>
        </div>
      )}

      {current?.type === 'gradient' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Dégradé</p>
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
            <input
              type="color"
              className={styles.color}
              value={current.gradient?.from ?? DEFAULT_GRADIENT.from}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, from: e.target.value } })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Arrivée</span>
            <input
              type="color"
              className={styles.color}
              value={current.gradient?.to ?? DEFAULT_GRADIENT.to}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, to: e.target.value } })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Angle</span>
            <input
              type="range"
              className={styles.range}
              min={0} max={360} step={15}
              value={current.gradient?.angle ?? DEFAULT_GRADIENT.angle}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, angle: parseInt(e.target.value, 10) } })}
            />
          </div>

          <button
            className={`${styles.toggle} ${current.animated ? styles.toggleOn : ''}`}
            onClick={() => onChange({ ...current, animated: !current.animated })}
          >
            {current.animated ? '✓ Dégradé animé' : 'Animer le dégradé'}
          </button>
        </div>
      )}

      {current?.type === 'image' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Image</p>
          {previewSrc && (
            <img
              src={previewSrc}
              style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }}
              alt=""
            />
          )}
          <input
            type="file"
            accept="image/*"
            className={styles.input}
            style={{ width: '100%', maxWidth: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const bytes = new Uint8Array(await file.arrayBuffer())
              const key = generateMediaKey(file.name)
              registerMedia(key, bytes, file.type)
              onChange({ ...current, image: key })
            }}
          />
          <div className={styles.field} style={{ marginTop: '0.5rem' }}>
            <span className={styles.fieldLabel}>Ajustement</span>
            <button
              className={styles.toggle}
              onClick={() => onChange({ ...current, imageFit: current.imageFit === 'contain' ? 'cover' : 'contain' })}
            >
              {current.imageFit === 'contain' ? 'Ajustée' : 'Recouvrante'}
            </button>
          </div>
        </div>
      )}

      {current && current.type !== 'color' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Superposition</p>
          <p className={styles.subtle}>
            Assombrit ou éclaircit le fond pour garder le texte lisible.
          </p>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <input
              type="color"
              className={styles.color}
              value={current.overlay?.color ?? '#000000'}
              onChange={e => setOverlay({ color: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Intensité</span>
            <input
              type="range"
              className={styles.range}
              min={0} max={0.9} step={0.05}
              value={current.overlay?.opacity ?? 0}
              onChange={e => setOverlay({ opacity: parseFloat(e.target.value) })}
            />
          </div>
        </div>
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

          <button
            className={`${styles.toggle} ${particlesOn ? styles.toggleOn : ''}`}
            onClick={() => setParticles({ enabled: !particlesOn })}
          >
            {particlesOn ? '✓ Particules actives' : 'Activer les particules'}
          </button>
        </div>
      )}

      {ultra && particlesOn && (
        <>
          <div className={styles.group}>
            <p className={styles.groupLabel}>Ambiances</p>
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
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Style</p>
            <div className={styles.presetList}>
              {PARTICLE_SHAPES.map(shape => (
                <button
                  key={shape.value}
                  className={`${styles.preset} ${p.shape === shape.value ? styles.presetActive : ''}`}
                  onClick={() => setParticles({ shape: shape.value })}
                >
                  <span className={styles.presetName}>{shape.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Animation</p>
            <div className={styles.presetList}>
              {PARTICLE_MOTIONS.map(motion => (
                <button
                  key={motion.value}
                  className={`${styles.preset} ${p.motion === motion.value ? styles.presetActive : ''}`}
                  onClick={() => setParticles({ motion: motion.value })}
                >
                  <span className={styles.presetName}>{motion.label}</span>
                </button>
              ))}
            </div>

            {p.motion === 'stream' && (
              <div className={styles.fieldStacked}>
                <span className={styles.fieldLabel}>Direction du flux</span>
                <div className={styles.rangeGroup}>
                  <input
                    type="range"
                    className={styles.range}
                    min={0} max={360} step={5}
                    value={p.direction}
                    onChange={e => setParticles({ direction: parseInt(e.target.value, 10) })}
                  />
                  <span className={styles.rangeValue}>{p.direction}°</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Réglages</p>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Quantité</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={5} max={400} step={5}
                  value={p.count}
                  onChange={e => setParticles({ count: parseInt(e.target.value, 10) })}
                />
                <span className={styles.rangeValue}>{p.count}</span>
              </div>
            </div>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Vitesse</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={0.1} max={3} step={0.1}
                  value={p.speed}
                  onChange={e => setParticles({ speed: parseFloat(e.target.value) })}
                />
                <span className={styles.rangeValue}>{p.speed.toFixed(1)}×</span>
              </div>
            </div>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Taille</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={1} max={24} step={0.5}
                  value={p.size}
                  onChange={e => setParticles({ size: parseFloat(e.target.value) })}
                />
                <span className={styles.rangeValue}>{p.size}px</span>
              </div>
            </div>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Variation de taille</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={0} max={1} step={0.05}
                  value={p.sizeVariation}
                  onChange={e => setParticles({ sizeVariation: parseFloat(e.target.value) })}
                />
                <span className={styles.rangeValue}>{Math.round(p.sizeVariation * 100)}%</span>
              </div>
            </div>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Opacité</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={0.05} max={1} step={0.05}
                  value={p.opacity}
                  onChange={e => setParticles({ opacity: parseFloat(e.target.value) })}
                />
                <span className={styles.rangeValue}>{Math.round(p.opacity * 100)}%</span>
              </div>
            </div>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Halo</span>
              <div className={styles.rangeGroup}>
                <input
                  type="range"
                  className={styles.range}
                  min={0} max={30} step={1}
                  value={p.glow}
                  onChange={e => setParticles({ glow: parseInt(e.target.value, 10) })}
                />
                <span className={styles.rangeValue}>{p.glow}px</span>
              </div>
            </div>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Couleurs</p>
            {p.colors.map((color, i) => (
              <div className={styles.field} key={i}>
                <span className={styles.fieldLabel}>Couleur {i + 1}</span>
                <input
                  type="color"
                  className={styles.color}
                  value={color}
                  onChange={e => setColorAt(i, e.target.value)}
                />
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
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Rendu</p>
            <button
              className={`${styles.toggle} ${p.additive ? styles.toggleOn : ''}`}
              onClick={() => setParticles({ additive: !p.additive })}
            >
              {p.additive ? '✓ Fusion additive' : 'Fusion additive'}
            </button>
            <button
              className={`${styles.toggle} ${p.twinkle ? styles.toggleOn : ''}`}
              style={{ marginTop: '0.35rem' }}
              onClick={() => setParticles({ twinkle: !p.twinkle })}
            >
              {p.twinkle ? '✓ Scintillement' : 'Scintillement'}
            </button>
            <button
              className={`${styles.toggle} ${p.rotate ? styles.toggleOn : ''}`}
              style={{ marginTop: '0.35rem' }}
              onClick={() => setParticles({ rotate: !p.rotate })}
            >
              {p.rotate ? '✓ Rotation des formes' : 'Rotation des formes'}
            </button>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Liens</p>
            <p className={styles.subtle}>
              Relie les particules proches par un trait — l'effet « constellation ».
              Au-delà de 220 particules, les liens sont ignorés pour préserver la fluidité.
            </p>
            <button
              className={`${styles.toggle} ${p.links.enabled ? styles.toggleOn : ''}`}
              onClick={() => setParticles({ links: { ...p.links, enabled: !p.links.enabled } })}
            >
              {p.links.enabled ? '✓ Liens actifs' : 'Activer les liens'}
            </button>

            {p.links.enabled && (
              <>
                <div className={styles.fieldStacked} style={{ marginTop: '0.5rem' }}>
                  <span className={styles.fieldLabel}>Portée</span>
                  <div className={styles.rangeGroup}>
                    <input
                      type="range"
                      className={styles.range}
                      min={30} max={300} step={10}
                      value={p.links.distance}
                      onChange={e => setParticles({ links: { ...p.links, distance: parseInt(e.target.value, 10) } })}
                    />
                    <span className={styles.rangeValue}>{p.links.distance}px</span>
                  </div>
                </div>
                <div className={styles.fieldStacked}>
                  <span className={styles.fieldLabel}>Épaisseur</span>
                  <div className={styles.rangeGroup}>
                    <input
                      type="range"
                      className={styles.range}
                      min={0.5} max={4} step={0.5}
                      value={p.links.width}
                      onChange={e => setParticles({ links: { ...p.links, width: parseFloat(e.target.value) } })}
                    />
                    <span className={styles.rangeValue}>{p.links.width}px</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Couleur des liens</span>
                  <input
                    type="color"
                    className={styles.color}
                    value={p.links.color ?? p.colors[0]}
                    onChange={e => setParticles({ links: { ...p.links, color: e.target.value } })}
                  />
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
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Réaction à la souris</p>
            <div className={styles.presetList}>
              {PARTICLE_MOUSE_MODES.map(mode => (
                <button
                  key={mode.value}
                  className={`${styles.preset} ${p.mouse.mode === mode.value ? styles.presetActive : ''}`}
                  onClick={() => setParticles({ mouse: { ...p.mouse, mode: mode.value } })}
                >
                  <span className={styles.presetName}>{mode.label}</span>
                </button>
              ))}
            </div>

            {p.mouse.mode !== 'none' && (
              <>
                <div className={styles.fieldStacked}>
                  <span className={styles.fieldLabel}>Rayon d'influence</span>
                  <div className={styles.rangeGroup}>
                    <input
                      type="range"
                      className={styles.range}
                      min={40} max={400} step={10}
                      value={p.mouse.radius}
                      onChange={e => setParticles({ mouse: { ...p.mouse, radius: parseInt(e.target.value, 10) } })}
                    />
                    <span className={styles.rangeValue}>{p.mouse.radius}px</span>
                  </div>
                </div>
                <div className={styles.fieldStacked}>
                  <span className={styles.fieldLabel}>Force</span>
                  <div className={styles.rangeGroup}>
                    <input
                      type="range"
                      className={styles.range}
                      min={0.1} max={2} step={0.1}
                      value={p.mouse.strength}
                      onChange={e => setParticles({ mouse: { ...p.mouse, strength: parseFloat(e.target.value) } })}
                    />
                    <span className={styles.rangeValue}>{p.mouse.strength.toFixed(1)}×</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}