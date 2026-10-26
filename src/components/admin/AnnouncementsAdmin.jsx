import { useState } from "react"
import BannerAdmin from "./BannerAdmin"
import NotificationsAdmin from "./NotificationsAdmin"
import { BellIcon } from "../Icons"

// Admin > Announcements: the website banner and phone notifications, with
// a switch that makes it obvious which one you're editing.

const KINDS = [
  { id: "banner", title: "Website banner", note: "A message across the top of every page" },
  { id: "notifications", title: "Phone notification", note: "Sent to every phone with alerts on" },
]

function BannerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M7 6.5h6" />
    </svg>
  )
}

const KIND_KEY = "ht-admin-announce"

function AnnouncementsAdmin() {
  const [kind, setKind] = useState(() => {
    try {
      return sessionStorage.getItem(KIND_KEY) === "notifications" ? "notifications" : "banner"
    } catch {
      return "banner"
    }
  })

  function pick(id) {
    setKind(id)
    try {
      sessionStorage.setItem(KIND_KEY, id)
    } catch {
      // Not remembered - fine.
    }
  }

  return (
    <div className="ana">
      <div className="ana-switch" role="tablist" aria-label="What are you sending?">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            className={`ana-option is-${k.id}${kind === k.id ? " is-active" : ""}`}
            onClick={() => pick(k.id)}
          >
            <span className="ana-option-icon">{k.id === "banner" ? <BannerIcon /> : <BellIcon size={20} />}</span>
            <span>
              <b>{k.title}</b>
              <small>{k.note}</small>
            </span>
          </button>
        ))}
      </div>
      <div className={`ana-panel is-${kind}`}>
        {kind === "banner" ? <BannerAdmin /> : <NotificationsAdmin />}
      </div>
    </div>
  )
}

export default AnnouncementsAdmin
