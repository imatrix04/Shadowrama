import type { BlockConfig } from '../../types'
import { CAROUSEL_EASINGS, CAROUSEL_TRANSITIONS } from '../../ultra/carouselTransitions'

const carouselConfig: BlockConfig = {
  type: 'carousel',
  label: 'Carrousel',
  icon: 'carousel',
  ultraOnly: true,
  defaultProps: {
    items: [],
    width: 480, height: 300,
    transition: 'slide-left',
    transitionSeconds: 0.6,
    ease: CAROUSEL_EASINGS[0].value,
    autoplay: true,
    interval: 4,
    loop: true,
    pauseOnHover: true,
    showArrows: true,
    showDots: true,
    controlColor: '#ffffff',
    borderRadius: 8,
    backgroundColor: '#000000',
    kenBurns: false,
  },
  properties: [
    { key: 'items', label: 'Images', type: 'carouselItems' },
    {
      key: 'transition',
      label: 'Animation',
      type: 'select',
      // Construites depuis la liste : ajouter une animation dans
      // ultra/carouselTransitions suffit à la proposer ici.
      options: CAROUSEL_TRANSITIONS.map(t => ({ label: t.label, value: t.id })),
    },
    { key: 'transitionSeconds', label: 'Durée (s)', type: 'number' },
    { key: 'ease', label: 'Courbe', type: 'select', options: CAROUSEL_EASINGS },
    { key: 'autoplay', label: 'Défilement auto', type: 'boolean' },
    { key: 'interval', label: 'Intervalle (s)', type: 'number', showIf: { key: 'autoplay', value: 'true' } },
    { key: 'pauseOnHover', label: 'Pause au survol', type: 'boolean', showIf: { key: 'autoplay', value: 'true' } },
    { key: 'loop', label: 'Boucler', type: 'boolean' },
    { key: 'kenBurns', label: 'Zoom lent (Ken Burns)', type: 'boolean' },
    { key: 'showArrows', label: 'Flèches', type: 'boolean' },
    { key: 'showDots', label: 'Puces', type: 'boolean' },
    { key: 'controlColor', label: 'Couleur des commandes', type: 'color' },
    { key: 'borderRadius', label: 'Arrondi du cadre', type: 'number' },
    { key: 'backgroundColor', label: 'Fond du cadre', type: 'color' },
  ],
}

export default carouselConfig