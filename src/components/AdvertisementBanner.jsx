import { useEffect, useState } from "react"
import { getAdvertisements } from "../data/googleSheets"
import { trackAd } from "../data/liveScoring"

// "10/25/26" or "10/25/2026" -> Date (blank -> null).
function parseDay(text) {
  const parts = String(text || "").trim().split("/").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return new Date(parts[2] < 100 ? 2000 + parts[2] : parts[2], parts[0] - 1, parts[1])
}

function AdvertisementBanner() {

  const [ad, setAd] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {

    getAdvertisements().then((rows) => {

      // Lowest Advertisement # wins if more than one row ever gets
      // added - keeps which ad shows predictable rather than "whatever
      // order the sheet happens to be in."
      // Ads running today (Start / End Date optional, set in Admin).
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

      // More than one running: each visit shows one of them.
      let pick = 0
      if (running.length > 1) {
        try {
          const saved = sessionStorage.getItem("ht-ad-pick")
          pick = saved !== null && Number.isInteger(Number(saved))
            ? Number(saved) % running.length
            : Math.floor(Math.random() * running.length)
          sessionStorage.setItem("ht-ad-pick", String(pick))
        } catch {
          pick = Math.floor(Math.random() * running.length)
        }
      }
      setAd(running[pick] || null)

    })

  }, [])

  // Anonymous view count (once per visit) for the sponsor stats.
  useEffect(() => {
    if (ad) trackAd("view", ad)
  }, [ad])

  if (!ad || dismissed) return null

  const title = ad["Advertisement Title"] || "Shop our store"

  return (

    <>

      {/* Desktop: a full-height skyscraper pinned to the right edge,
          top to bottom. */}
      <div className="ad-banner ad-banner-desktop">

        <button
          type="button"
          className="ad-banner-close"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss advertisement"
        >
          ×
        </button>

        <span className="ad-banner-tag">Sponsor</span>

        <a
          href={ad["Store Link"]}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ad-banner-link"
          onClick={() => trackAd("click", ad)}
        >
          <img
            src={ad["Store Picture Desktop"]}
            alt={title}
            className="ad-banner-image"
          />
        </a>

      </div>

      {/* Mobile: a full-width bar pinned to the bottom, left to right. */}
      <div className="ad-banner ad-banner-mobile">

        <span className="ad-banner-tag">Sponsor</span>

        <a
          href={ad["Store Link"]}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ad-banner-link"
          onClick={() => trackAd("click", ad)}
        >
          <img
            src={ad["Store Picture Mobile"]}
            alt={title}
            className="ad-banner-image"
          />
        </a>

        <button
          type="button"
          className="ad-banner-close"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss advertisement"
        >
          ×
        </button>

      </div>

    </>

  )

}

export default AdvertisementBanner
