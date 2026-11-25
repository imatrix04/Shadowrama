import type { BlockConfig, ChartBlockData, ChartDatum } from '../../types'
import { FONT_OPTIONS } from '../../utils/fonts'
import { nextId } from '../../utils/ids'

/** Données d'exemple d'un graphique neuf : de quoi voir l'animation tout de suite. */
function sampleData(): ChartDatum[] {
  return [
    { id: nextId(), label: 'T1', value: 32 },
    { id: nextId(), label: 'T2', value: 54 },
    { id: nextId(), label: 'T3', value: 41 },
    { id: nextId(), label: 'T4', value: 78 },
  ]
}

// Pas de `ultraOnly` : le graphique s'anime tout seul, sans mode Ultra Design.
// En revanche il est en bêta : Paramètres → Fonctionnalités → Bloc Graphique.
const chartConfig: BlockConfig = {
  type: 'chart',
  label: 'Graphique',
  icon: 'chart',
  beta: 'chart',
  // Lu à chaque ajout : chaque graphique reçoit ses propres identifiants de données.
  get defaultProps(): Partial<ChartBlockData> {
    return {
      chartKind: 'column',
      data: sampleData(),
      colorMode: 'palette',
      accentColor: '#6c8cff',
      fontSize: 16,
      unit: '',
      showLabels: true,
      showValues: true,
      showGrid: true,
      showLegend: true,
      smooth: true,
      ringWidth: 0.45,
      borderRadius: 0,
      animated: true,
      animSeconds: 1.2,
      animDelay: 0.3,
      animEase: 'smooth',
      cascade: true,
      width: 520,
      height: 320,
    }
  },
  properties: [
    { key: 'data', label: 'Données', type: 'chartData' },
    {
      key: 'chartKind',
      label: 'Type de graphique',
      type: 'select',
      options: [
        { label: 'Colonnes', value: 'column' },
        { label: 'Barres', value: 'bar' },
        { label: 'Courbe', value: 'line' },
        { label: 'Aire', value: 'area' },
        { label: 'Camembert', value: 'pie' },
        { label: 'Anneau', value: 'donut' },
      ],
    },
    { key: 'unit', label: 'Unité (%, k€…)', type: 'text' },
    {
      key: 'colorMode',
      label: 'Couleurs',
      type: 'select',
      options: [
        { label: 'Palette', value: 'palette' },
        { label: 'Couleur unique', value: 'single' },
      ],
    },
    { key: 'accentColor', label: 'Couleur', type: 'color', showIf: { key: 'colorMode', value: 'single' } },
    { key: 'textColor', label: 'Couleur du texte', type: 'color' },
    { key: 'fontFamily', label: 'Police', type: 'select', options: FONT_OPTIONS },
    { key: 'fontSize', label: 'Taille du texte', type: 'number' },
    { key: 'showLabels', label: 'Étiquettes', type: 'boolean' },
    { key: 'showValues', label: 'Valeurs', type: 'boolean' },
    { key: 'showGrid', label: 'Quadrillage', type: 'boolean', showIf: { key: 'chartKind', value: 'column|bar|line|area' } },
    { key: 'smooth', label: 'Courbe lissée', type: 'boolean', showIf: { key: 'chartKind', value: 'line|area' } },
    { key: 'showLegend', label: 'Légende', type: 'boolean', showIf: { key: 'chartKind', value: 'pie|donut' } },
    { key: 'ringWidth', label: 'Épaisseur de l\'anneau', type: 'float', showIf: { key: 'chartKind', value: 'donut' } },
    { key: 'backgroundColor', label: 'Fond', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi du cadre', type: 'number' },
    { key: 'animated', label: 'Animer l\'apparition', type: 'boolean' },
    { key: 'animSeconds', label: 'Durée (s)', type: 'number', showIf: { key: 'animated', value: 'true' } },
    { key: 'animDelay', label: 'Délai (s)', type: 'number', showIf: { key: 'animated', value: 'true' } },
    {
      key: 'animEase',
      label: 'Style',
      type: 'select',
      showIf: { key: 'animated', value: 'true' },
      options: [
        { label: 'Doux', value: 'smooth' },
        { label: 'Rebond', value: 'bounce' },
        { label: 'Linéaire', value: 'linear' },
      ],
    },
    { key: 'cascade', label: 'Une donnée après l\'autre', type: 'boolean', showIf: { key: 'animated', value: 'true' } },
  ],
}

export default chartConfig
