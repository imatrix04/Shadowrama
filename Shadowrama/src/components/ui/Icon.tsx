export type IconName =
  | 'text' | 'title' | 'image' | 'shape'
  | 'slides' | 'chevronLeft' | 'chevronRight'
  | 'new' | 'save' | 'open' | 'play' | 'undo' | 'redo'
  | 'ultra' | 'motion' | 'effects' | 'transition' | 'background'
  | 'animNone' | 'animFade' | 'animSlideLeft' | 'animSlideRight' | 'animSlideUp' | 'animZoom'

interface Props {
  name: IconName
  size?: number
  className?: string
}

const PATHS: Record<IconName, React.ReactNode> = {
  text: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h11" />
      <path d="M4 17h7" />
    </>
  ),
  title: (
    <>
      <path d="M5 6h14" />
      <path d="M12 6v12" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-6 6" />
    </>
  ),
  shape: (
    <>
      <rect x="3" y="3" width="11" height="11" rx="1.5" />
      <circle cx="16" cy="16" r="5" />
    </>
  ),
  slides: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
    </>
  ),
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,

  ultra: (
    <>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
      <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />
    </>
  ),
  motion: (
    <>
      <path d="M3 17c4 0 5-10 9-10s5 5 9 5" />
      <circle cx="3" cy="17" r="1.4" />
    </>
  ),
  transition: (
    <>
      <rect x="2" y="6" width="8" height="12" rx="1.5" />
      <rect x="14" y="6" width="8" height="12" rx="1.5" />
      <path d="M10.5 12h3" />
      <path d="M12.2 10.5l1.5 1.5-1.5 1.5" />
    </>
  ),
  effects: (
    <>
      <circle cx="9" cy="9" r="6" />
      <circle cx="15" cy="15" r="6" />
    </>
  ),
  background: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15l4.5-4.5 3.5 3.5 5-6 5.5 6.5" />
    </>
  ),
  new: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v4M10 14h4" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </>
  ),
  open: (
    <>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </>
  ),
  play: <path d="M7 4l12 8-12 8z" />,
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h9a7 7 0 010 14H8" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9h-9a7 7 0 000 14h5" />
    </>
  ),

  // Les icônes d'animation figurent le mouvement : un repère fixe (le cadre)
  // et une flèche indiquant le sens d'entrée.
  animNone: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 4l16 16" />
    </>
  ),
  animFade: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M9 6v12" strokeOpacity="0.45" />
      <path d="M14 6v12" strokeOpacity="0.75" />
    </>
  ),
  animSlideLeft: (
    <>
      <rect x="10" y="6" width="10" height="12" rx="2" />
      <path d="M7 12H2" />
      <path d="M5 9l-3 3 3 3" />
    </>
  ),
  animSlideRight: (
    <>
      <rect x="4" y="6" width="10" height="12" rx="2" />
      <path d="M17 12h5" />
      <path d="M19 9l3 3-3 3" />
    </>
  ),
  animSlideUp: (
    <>
      <rect x="6" y="3" width="12" height="10" rx="2" />
      <path d="M12 22v-5" />
      <path d="M9 19l3-3 3 3" />
    </>
  ),
  animZoom: (
    <>
      <rect x="7" y="8" width="10" height="8" rx="1.5" />
      <path d="M3 3h4M3 3v4" />
      <path d="M21 21h-4M21 21v-4" />
    </>
  ),
}

export default function Icon({ name, size = 16, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}