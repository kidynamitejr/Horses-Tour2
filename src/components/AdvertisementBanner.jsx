import { useEffect, useState } from "react"
import { getAdvertisements } from "../data/googleSheets"
import { trackAd } from "../data/liveScoring"

// How long each ad stays up before the next one slides up into place.
const SLIDE_MS = 6000

// "10/25/26" or "10/25/2026" -> Date (blank -> null).
function parseDay(text) {
  const parts = String(text || "").trim().split("/").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return new Date(parts[2] < 100 ? 2000 + parts[2] : parts[2], parts[0] - 1, parts[1])
}

// One slide per running ad (each row in Admin > Sponsors).
function buildSlides(running) {
  return running
    .map((ad) => ({ ad, desktop: ad["Store Picture Desktop"], mobile: ad["Store Picture Mobile"] }))
    .filter((s) => s.desktop || s.mobile)
}

function AdSlide({ slide, field, className, onClick }) {
  const title = slide.ad["Advertisement Title"] || "Shop our store"
  return (
    <a
      href={slide.ad["Store Link"]}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`ad-banner-link ad-slide${className ? ` ${className}` : ""}`}
      onClick={onClick}
      tabIndex={className === "is-leaving" ? -1 : undefined}
      aria-hidden={className === "is-leaving" ? "true" : undefined}
    >
      <img src={slide[field] || slide.desktop || slide.mobile} alt={title} className="ad-banner-image" />
    </a>
  )
}

function AdvertisementBanner() {

  const [slides, setSlides] = useState([])
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {

    getAdvertisements().then((rows) => {

      // Ads running today (Start / End Date optional, set in Admin),
      // lowest Advertisement # first so the order is predictable.
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const running = rows
        .filter((row) => row["Store Link"])
        .filter((row) => {
          const start = parseDay(row["Start Date"])
          const end = parseDay(row["End Date"])
          return (!start || start <= today) && (!end || end >= today)
        })
        .sort((a, b) => Number(a["Advertisement #"]) - Number(b["Advertisement #"]))

      const list = buildSlides(running)

      // Warm the cache so each slide is ready before it slides in.
      list.forEach((s) => [s.desktop, s.mobile].forEach((src) => {
        if (src) new Image().src = src
      }))

      // Start somewhere different each visit so every design gets seen.
      setStep(list.length > 1 ? Math.floor(Math.random() * list.length) : 0)
      setSlides(list)

    }).catch(() => {})

  }, [])

  const count = slides.length
  const rotating = count > 1 && !paused && !dismissed

  useEffect(() => {
    if (!rotating) return
    const timer = setInterval(() => {
      if (!document.hidden) setStep((s) => s + 1)
    }, SLIDE_MS)
    return () => clearInterval(timer)
  }, [rotating])

  const current = count ? slides[step % count] : null
  const previous = count > 1 && step > 0 ? slides[(step - 1) % count] : null
  const moved = previous && previous !== current

  // Anonymous view count (once per ad per visit) for the sponsor stats.
  useEffect(() => {
    if (current && !dismissed) trackAd("view", current.ad)
  }, [current, dismissed])

  if (!current || dismissed) return null

  const hover = {
    // Mouse only: a tap on a phone would otherwise "hover" forever.
    onPointerEnter: (e) => { if (e.pointerType === "mouse") setPaused(true) },
    onPointerLeave: () => setPaused(false),
  }

  const renderSlides = (field) => (
    <>
      {moved && <AdSlide key={`out-${step}`} slide={previous} field={field} className="is-leaving" />}
      <AdSlide
        key={`in-${step}`}
        slide={current}
        field={field}
        className={moved ? "is-entering" : ""}
        onClick={() => trackAd("click", current.ad)}
      />
    </>
  )

  const close = (
    <button
      type="button"
      className="ad-banner-close"
      onClick={() => setDismissed(true)}
      aria-label="Dismiss advertisement"
    >
      ×
    </button>
  )

  return (

    <>

      {/* Desktop: a tall skyscraper pinned to the right edge. */}
      <div className="ad-banner ad-banner-desktop" {...hover}>
        {close}
        <span className="ad-banner-tag">Sponsor</span>
        {renderSlides("desktop")}
      </div>

      {/* Mobile: a full-width bar pinned to the bottom. */}
      <div className="ad-banner ad-banner-mobile" {...hover}>
        <span className="ad-banner-tag">Sponsor</span>
        {renderSlides("mobile")}
        {close}
      </div>

    </>

  )

}

export default AdvertisementBanner
