import { useState } from 'react'
import type { Slide } from '../../types'
import { saveProject, loadProject } from '../../utils/fileManager'
import PresentationMode from './PresentationMode'

interface Props {
  slides: Slide[]
  projectName: string | null
  setProjectName: (name: string) => void
  onLoad: (slides: Slide[], name: string) => void
}

export default function TopBar({ slides, projectName, setProjectName, onLoad }: Props) {
  const [presenting, setPresenting] = useState(false)

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const loaded = await loadProject(file)
      const name = file.name.replace('.shma', '')
      onLoad(loaded, name)
    } catch {
      alert('Impossible de lire ce fichier .shma')
    }
    e.target.value = ''
  }

  const handleSave = () => {
    if (projectName) {
      saveProject(slides, projectName)
    } else {
      const name = prompt('Nom du projet :', 'mon-projet')
      if (!name) return
      setProjectName(name)
      saveProject(slides, name)
    }
  }

  return (
    <>
      <div style={styles.topBar}>
        <span style={styles.logo}>Shadowrama</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={btnStyle} onClick={handleSave}>
            💾 Sauvegarder
          </button>
          <label style={btnStyle}>
            📂 Ouvrir
            <input
              type="file"
              accept=".shma"
              style={{ display: 'none' }}
              onChange={handleLoad}
            />
          </label>
          <button style={{ ...btnStyle, backgroundColor: '#6c63ff', border: '1px solid #8b84ff' }}
            onClick={() => setPresenting(true)}>
            ▶ Présenter
          </button>
        </div>
      </div>

      {presenting && (
        <PresentationMode
          slides={slides}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  backgroundColor: '#2a2a3e',
  border: '1px solid #444',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 1rem',
    backgroundColor: '#111',
    borderBottom: '1px solid #333',
    zIndex: 10,
    height: '48px',
    flexShrink: 0,
  },
  logo: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#6c63ff',
    letterSpacing: '1px',
  }
}