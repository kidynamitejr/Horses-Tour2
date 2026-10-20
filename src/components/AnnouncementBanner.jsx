import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getSettings } from "../data/liveScoring"

// The announcement set in Admin > Banner, across the top of every page.
// Closing it hides that message until a new one is posted.

const DISMISS_KEY = "ht-announcement-dismissed"

function AnnouncementBanner() {
  const [settings, setSettings] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) || ""
    } catch {
      return ""
    }
  })

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
  }, [])

  const text = (settings?.announcement_text || "").trim()
  if (!text || settings.announcement_on !== "yes" || dismissed === text) return null

  const style = ["info", "warning", "urgent"].includes(settings.announcement_style) ? settings.announcement_style : "info"
  const link = (settings.announcement_link || "").trim()

  function close() {
    setDismissed(text)
    try {
      localStorage.setItem(DISMISS_KEY, text)
    } catch {
      // Not remembered - it'll show again next visit.
    }
  }

  return (
    <div className={`site-announcement is-${style}`} role="status">
      {/* The message scrolls across on a loop (two copies so it's seamless). */}
      <div className="sa-marquee">
        <div className="sa-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="sa-item" aria-hidden={copy === 1 ? "true" : undefined}>
              {text}
              {link && (link.startsWith("/")
                ? <Link to={link} tabIndex={copy === 1 ? -1 : undefined}>Learn more →</Link>
                : <a href={link} target="_blank" rel="noopener noreferrer" tabIndex={copy === 1 ? -1 : undefined}>Learn more →</a>)}
            </span>
          ))}
        </div>
      </div>
      <button type="button" onClick={close} aria-label="Close announcement">×</button>
    </div>
  )
}

export default AnnouncementBanner
