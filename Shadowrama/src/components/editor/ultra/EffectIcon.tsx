export type EffectKey = 'shadow' | 'glow' | 'glass' | 'float' | 'gradient' | 'corners' | 'textStroke' | 'filters'

/** Pictogrammes des effets, dessinés pour se reconnaître à 24 px. */
export default function EffectIcon({ name }: { name: EffectKey }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'shadow':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2.5" fill="currentColor" opacity="0.28" stroke="none" />
          <rect x="4" y="4" width="12" height="12" rx="2.5" />
        </svg>
      )
    case 'glow':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <circle cx="12" cy="12" r="7" opacity="0.55" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" opacity="0.7" />
        </svg>
      )
    case 'glass':
      return (
        <svg {...common}>
          <circle cx="8.5" cy="9" r="4" fill="currentColor" opacity="0.3" stroke="none" />
          <rect x="6" y="6" width="14" height="14" rx="3.5" />
          <path d="M10 17l5-5M12.5 18.5l5.5-5.5" opacity="0.55" />
        </svg>
      )
    case 'float':
      return (
        <svg {...common}>
          <rect x="7" y="3.5" width="10" height="10" rx="2.5" />
          <ellipse cx="12" cy="19" rx="5" ry="1.6" fill="currentColor" opacity="0.3" stroke="none" />
          <path d="M12 15.5v1" opacity="0.6" />
        </svg>
      )
    case 'gradient':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="fx-icon-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="16" height="16" rx="3" fill="url(#fx-icon-gradient)" />
        </svg>
      )
    case 'corners':
      return (
        <svg {...common}>
          <path d="M4 20V11a7 7 0 017-7h9" />
          <path d="M4 20h2M20 4v2" opacity="0.5" />
        </svg>
      )
    case 'textStroke':
      return (
        <svg {...common}>
          <path d="M5 20L12 4l7 16M8.2 14h7.6" />
        </svg>
      )
    case 'filters':
      return (
        <svg {...common}>
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h5M13 12h7" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
          <circle cx="11" cy="12" r="2" />
        </svg>
      )
  }
}
