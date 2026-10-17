import { findCourseLogo } from "../siteConfig"

// Club-style crest for a player's home course. If a real logo has been
// added for the course in siteConfig.js (COURSE_LOGOS), that image is shown
// instead, straight on the page (transparent PNG).

const CREST_COLORS = ["#1f5c3f", "#002140", "#6b2c2c", "#3d4f7a", "#7a5a1f", "#245b63"]

const STOP_WORDS = new Set(["the", "at", "of", "and", "&", "golf", "course", "club", "country", "gc", "cc"])

function getInitials(name) {
  const words = name.replace(/[^A-Za-z0-9.& ]/g, " ").split(/\s+/).filter(Boolean)
  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()))
  const source = meaningful.length ? meaningful : words
  return source
    .slice(0, 2)
    .map((w) => w.replace(/\./g, "")[0])
    .join("")
    .toUpperCase()
}

function pickColor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CREST_COLORS[hash % CREST_COLORS.length]
}

function CourseCrest({ course, playerId = null, size = 52, onDark = false }) {
  if (!course) return null

  const logo = findCourseLogo(course, playerId)

  if (logo) {
    return (
      <span className="course-logo-plate" style={{ height: size, maxWidth: Math.round(size * 3.4) }}>
        <img src={onDark ? logo.dark : logo.src} alt={`${course} logo`} />
      </span>
    )
  }

  const color = pickColor(course)
  const initials = getInitials(course)

  return (
    <svg
      className="course-crest"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${course} crest`}
    >
      <circle cx="32" cy="32" r="31" fill={color} />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#e8d9a8" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#e8d9a8" strokeWidth=".6" opacity=".7" />

      {/* small flag on top */}
      <path d="M32 9.5v7" stroke="#e8d9a8" strokeWidth="1.2" />
      <path d="M32.6 9.6l4.4 1.6-4.4 1.6z" fill="#e8d9a8" />

      <text
        x="32"
        y="39"
        textAnchor="middle"
        fontFamily="'Red Hat Display', Georgia, serif"
        fontWeight="800"
        fontSize={initials.length > 1 ? 18 : 22}
        fill="#fff"
        letterSpacing="1"
      >
        {initials}
      </text>

      <path d="M20 46.5h24" stroke="#e8d9a8" strokeWidth="1" />
    </svg>
  )
}

export default CourseCrest
