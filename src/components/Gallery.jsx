import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { getGallery, getSchedule } from "../data/googleSheets"
import GalleryUpload from "./GalleryUpload"
import { parseEventDate } from "../utils/liveEvent"

// Full-screen photo viewer, shared with the Hall of Champions. `photos` is
// a list of { Image, Caption, Subtitle? }.
export function Lightbox({ photos, index, onClose, onNavigate }) {

  const photo = photos[index]

  // Lets the arrow keys and Escape drive the lightbox while it's open.
  useEffect(() => {

    function handleKeyDown(e) {

      if (e.key === "Escape") onClose()

      if (e.key === "ArrowRight") onNavigate((index + 1) % photos.length)

      if (e.key === "ArrowLeft") onNavigate((index - 1 + photos.length) % photos.length)

    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)

  }, [index, photos.length, onClose, onNavigate])

  return createPortal(

    <div className="lb-overlay" onClick={onClose}>

      <div className="lb-top" onClick={(e) => e.stopPropagation()}>
        <span className="lb-count">{index + 1} / {photos.length}</span>
        <button type="button" className="lb-btn" onClick={onClose} aria-label="Close">×</button>
      </div>

      {photos.length > 1 && (
        <button
          type="button"
          className="lb-btn lb-nav lb-prev"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((index - 1 + photos.length) % photos.length)
          }}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}

      <figure className="lb-figure" onClick={(e) => e.stopPropagation()}>

        <img key={photo.Image} src={photo.Image} alt={photo.Caption || ""} className="lb-image" />

        {(photo.Caption || photo.Subtitle) && (
          <figcaption className="lb-caption">
            {photo.Caption && <strong>{photo.Caption}</strong>}
            {photo.Subtitle && <span>{photo.Subtitle}</span>}
          </figcaption>
        )}

      </figure>

      {photos.length > 1 && (
        <button
          type="button"
          className="lb-btn lb-nav lb-next"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((index + 1) % photos.length)
          }}
          aria-label="Next photo"
        >
          ›
        </button>
      )}

    </div>,

    document.body

  )

}

function Gallery() {

  const [photos, setPhotos] = useState([])
  const [eventNames, setEventNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [openIndex, setOpenIndex] = useState(null)

  useEffect(() => {

    async function loadGallery() {

      try {

        const [data, schedule] = await Promise.all([getGallery(), getSchedule()])

        const names = {}
        schedule.forEach((e) => {
          names[e["Event ID"]] = { name: (e["Event Name"] || "").trim(), date: e.Date }
        })

        setEventNames(names)

        // New photos get added as new rows at the bottom of the sheet,
        // so reversing puts the most recently added ones first instead
        // of making people scroll down to find them.
        setPhotos([...data].filter((p) => p.Image).reverse())

      } catch (error) {

        console.error("Gallery Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadGallery()

  }, [])

  // Events that have at least one photo, newest first.
  const eventIds = [...new Set(photos.map((p) => p["Event ID"]).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a))

  const shown = filter === "all" ? photos : photos.filter((p) => p["Event ID"] === filter)

  // Every event photos can be added to: ones already played first (newest
  // at the top), then upcoming ones, then "General" for anything else.
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const allEvents = Object.entries(eventNames).map(([id, e]) => ({ id, name: e.name, date: parseEventDate(e.date) }))
  const played = allEvents.filter((e) => e.date && e.date <= today).sort((a, b) => b.date - a.date)
  const upcoming = allEvents.filter((e) => !e.date || e.date > today).sort((a, b) => (a.date || 0) - (b.date || 0))
  const uploadEvents = [
    ...played.map((e) => ({ id: e.id, name: e.name })),
    ...upcoming.map((e) => ({ id: e.id, name: `${e.name} (upcoming)` })),
    { id: "", name: "General / no event" },
  ]

  const lightboxPhotos = shown.map((p) => ({
    Image: p.Image,
    Caption: (p.Caption || "").trim(),
    Subtitle: eventNames[p["Event ID"]]
      ? `${eventNames[p["Event ID"]].name} · ${eventNames[p["Event ID"]].date}`
      : "",
  }))

  return (

    <section className="card gal">

      <div className="gal-head">
        <div>
          <h2>Gallery</h2>
          <p>{loading ? "Loading photos..." : `${photos.length} photos from ${eventIds.length} event${eventIds.length === 1 ? "" : "s"}`}</p>
        </div>

        {Object.keys(eventNames).length > 0 && (
          <GalleryUpload
            events={uploadEvents}
            defaultEventId={uploadEvents[0].id}
            onUploaded={(photo) => {
              setFilter("all")
              setPhotos((list) => [photo, ...list])
            }}
          />
        )}

        {eventIds.length > 1 && (
          <div className="gal-filters" role="tablist" aria-label="Filter by event">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All <span>{photos.length}</span>
            </button>
            {eventIds.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {eventNames[id]?.name || `Event ${id}`} <span>{photos.filter((p) => p["Event ID"] === id).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="gal-grid">

        {shown.map((photo, index) => (

          <button
            type="button"
            className="gal-item"
            key={photo["Photo ID"]}
            onClick={() => setOpenIndex(index)}
          >

            <img src={photo.Image} alt={photo.Caption || "Tour photo"} loading="lazy" />

            <span className="gal-item-overlay">
              {photo.Caption && photo.Caption.trim() && <strong>{photo.Caption.trim()}</strong>}
              {eventNames[photo["Event ID"]] && <small>{eventNames[photo["Event ID"]].name}</small>}
            </span>

            <span className="gal-zoom" aria-hidden="true">⤢</span>

          </button>

        ))}

      </div>

      {!loading && shown.length === 0 && <p className="gal-empty">No photos yet.</p>}

      {openIndex !== null && (
        <Lightbox
          photos={lightboxPhotos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}

    </section>

  )

}

export default Gallery
