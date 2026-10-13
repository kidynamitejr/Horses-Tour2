import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"

const BASE = import.meta.env.BASE_URL

// Shared shell for the team popups (Matchup Preview + Match Recap):
// a header band, then one panel per player, then any detail sections.
export function TeamModal({ eyebrow, title, tags, onClose, children }) {

  // Escape closes the popup.
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  return createPortal(

    <div className="tm-overlay" onClick={onClose}>

      <div className="tm" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>

        <header className="tm-head">
          <div>
            <span className="tm-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>

          <div className="tm-head-side">
            {tags}
            <button type="button" className="tm-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="tm-body">{children}</div>

      </div>

    </div>,

    document.body

  )

}

function Cutout({ id, name }) {
  const [src, setSrc] = useState(`${BASE}images/players/cutouts/${id || "default"}.png`)
  return (
    <img
      className="tm-cutout"
      src={src}
      alt={name}
      onError={() => setSrc(`${BASE}images/players/cutouts/default.png`)}
    />
  )
}

// One player's panel: cut-out photo on the gray backdrop, name, a badge in
// the corner and a short list of stats.
export function TeamModalPlayer({ id, name, badge, stats }) {

  const parts = name.split(" ")
  const last = parts.length > 1 ? parts.pop() : ""
  const first = parts.join(" ")

  return (
    <Link to={id ? `/player-profile/${id}` : "/players"} className="tm-player">

      <div className="tm-player-art">
        {badge && <span className="tm-player-badge">{badge}</span>}
        <Cutout id={id} name={name} />
      </div>

      <div className="tm-player-info">
        <h3>
          <span>{first}</span>
          {last && <strong>{last}</strong>}
        </h3>

        <dl className="tm-player-stats">
          {stats.map(({ label, value, highlight }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={highlight ? "is-highlight" : ""}>{value}</dd>
            </div>
          ))}
        </dl>

        <span className="tm-player-link">View profile →</span>
      </div>

    </Link>
  )

}

export function TeamModalSection({ title, children }) {
  return (
    <section className="tm-section">
      <h4>{title}</h4>
      {children}
    </section>
  )
}
