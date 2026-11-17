import { createContext } from 'react'

/**
 * Couleurs déjà utilisées dans le projet, fournies par l'éditeur : le sélecteur
 * de couleur les propose dans sa ligne « Du projet ». Vide hors de l'éditeur.
 */
export const ProjectColorsContext = createContext<string[]>([])
