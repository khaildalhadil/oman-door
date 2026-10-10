type P = { size?: number }

export const ArrowIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const CloseIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const PlayIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
)

export const ExpandIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const GaugeIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 16a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 16l4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const EyeIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
)

export const HomeIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

export const BoardIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/** Omani-style crenellation motif used as a decorative divider */
export const Crenels = () => (
  <svg className="crenels" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden>
    <path
      d="M0 12V6h6l3-5 3 5h6V6h6l3-5 3 5h6V6h6l3-5 3 5h6V6h6l3-5 3 5h6V6h6l3-5 3 5h6V6h6l3-5 3 5h6V6h6l3-5 3 5h6v6z"
      fill="currentColor"
    />
  </svg>
)
