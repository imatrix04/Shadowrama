import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={styles.container}>
      <h1>Shadorama</h1>
      <button style={styles.button} onClick={() => navigate('/editor')}>
        Créer un diaporama
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a1a2e', color: '#fff' },
  button: { marginTop: '2rem', padding: '0.8rem 2rem', fontSize: '1rem', backgroundColor: '#6c63ff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' },
}