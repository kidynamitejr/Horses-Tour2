import { useEffect, useState } from "react"
import { getAdvertisements } from "../data/googleSheets"

function AdvertisementBanner() {

  const [ad, setAd] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {

    getAdvertisements().then((rows) => {

      // Lowest Advertisement # wins if more than one row ever gets
      // added - keeps which ad shows predictable rather than "whatever
      // order the sheet happens to be in."
      const sorted = rows
        .filter((row) => row["Store Link"])
        .sort((a, b) => Number(a["Advertisement #"]) - Number(b["Advertisement #"]))

      setAd(sorted[0] || null)

    })

  }, [])

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

        <a
          href={ad["Store Link"]}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ad-banner-link"
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

        <a
          href={ad["Store Link"]}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ad-banner-link"
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
