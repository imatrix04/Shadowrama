import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const goToEditor = () => navigate('/editor')

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>
          Shadowrama<span className={styles.logoDot}>.</span>
        </span>
      </nav>

      <section className={styles.hero}>
        <div>
          <h1 className={styles.title}>
            Des présentations qui <span className={styles.titleAccent}>bougent</span> comme le web.
          </h1>
          <p className={styles.lead}>
            Shadowrama est un éditeur de diaporamas pensé pour le mouvement : blocs animés,
            transitions sur mesure, mise en page libre. Construit comme une page web, pas
            comme un fichier figé.
          </p>
          <div className={styles.ctaRow}>
            <button className={styles.ctaPrimary} onClick={goToEditor}>
              Créer un diaporama
            </button>
          </div>
        </div>

        <div className={styles.mockStage}>
          <div className={`${styles.mockBlock} ${styles.mockShape}`} />
          <div className={`${styles.mockBlock} ${styles.mockImage}`} />
          <div className={`${styles.mockBlock} ${styles.mockText}`} />
          <div className={`${styles.mockBlock} ${styles.mockTextSmall}`} />
        </div>
      </section>
    </div>
  )
}