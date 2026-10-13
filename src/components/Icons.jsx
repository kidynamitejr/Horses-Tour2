// Simple line icons (24x24, stroke = currentColor) for the redesigned layout.

function Icon({ children, size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const FlagIcon = (p) => (
  <Icon {...p}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></Icon>
)

export const UsersIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.8c2 .7 3.2 2.5 3.5 5.2" />
  </Icon>
)

export const ChartIcon = (p) => (
  <Icon {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M21 20H3" /></Icon>
)

export const MapPinIcon = (p) => (
  <Icon {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Icon>
)

export const TrophyIcon = (p) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 6H4.5c0 3 1.5 4.5 3.6 4.8" />
    <path d="M16 6h3.5c0 3-1.5 4.5-3.6 4.8" />
    <path d="M12 13v4" /><path d="M8 20h8" /><path d="M9.5 17h5v3h-5z" />
  </Icon>
)

export const CalendarIcon = (p) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></Icon>
)

export const DollarIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9.2c-.5-1-1.6-1.6-3-1.6-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.5 0 1.3-1.3 2.2-3 2.2-1.5 0-2.7-.6-3.2-1.7" /><path d="M12 6v1.6M12 16.5V18" /></Icon>
)

export const TargetIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></Icon>
)

export const ChevronRightIcon = (p) => (
  <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>
)

export const SwapIcon = (p) => (
  <Icon {...p}><path d="M7 7h12l-3-3" /><path d="M17 17H5l3 3" /></Icon>
)

export const CardIcon = (p) => (
  <Icon {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 15h8M8 18h5" /><circle cx="12" cy="9" r="2.5" /></Icon>
)

// Small US flag (every Horses Tour player is from the USA).
export function UsaFlag({ width = 20 }) {
  const stripes = Array.from({ length: 7 }, (_, i) => i * 2)
  return (
    <svg width={width} height={width * 0.6} viewBox="0 0 38 23" aria-label="United States flag" role="img" className="usa-flag">
      <rect width="38" height="23" fill="#fff" />
      {stripes.map((i) => (
        <rect key={i} y={i * (23 / 13)} width="38" height={23 / 13} fill="#b22234" />
      ))}
      <rect width="16" height={23 * 7 / 13} fill="#3c3b6e" />
    </svg>
  )
}

export const ArrowRightIcon = (p) => (
  <Icon {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Icon>
)

export const ChevronDownIcon = (p) => (
  <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
)

export const MenuIcon = (p) => (
  <Icon {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Icon>
)

export const CloseIcon = (p) => (
  <Icon {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Icon>
)

export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (p) => (
  <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Icon>
)
