import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { getGallery } from "../data/googleSheets"

function Lightbox({ photos, index, onClose, onNavigate }) {

  const photo = photos[index]

  return createPortal(

    <div className="gallery-lightbox-overlay" onClick={onClose}>

      <button
        type="button"
        className="gallery-lightbox-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          className="gallery-lightbox-nav gallery-lightbox-prev"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((index - 1 + photos.length) % photos.length)
          }}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}

      <figure
        className="gallery-lightbox-figure"
        onClick={(e) => e.stopPropagation()}
      >

        <img
          src={photo.Image}
          alt={photo.Caption}
          className="gallery-lightbox-image"
        />

        {photo.Caption && (
          <figcaption className="gallery-lightbox-caption">
            {photo.Caption}
          </figcaption>
        )}

      </figure>

      {photos.length > 1 && (
        <button
          type="button"
          className="gallery-lightbox-nav gallery-lightbox-next"
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
  const [loading, setLoading] = useState(true)
  const [openIndex, setOpenIndex] = useState(null)

  useEffect(() => {

    async function loadGallery() {

      try {

        const data = await getGallery()

        // New photos get added as new rows at the bottom of the sheet,
        // so reversing puts the most recently added ones first instead
        // of making people scroll down to find them.
        setPhotos([...data].reverse())

      } catch (error) {

        console.error("Gallery Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadGallery()

  }, [])

  // Lets the arrow keys and Escape drive the lightbox once it's open.
  useEffect(() => {

    if (openIndex === null) return

    function handleKeyDown(e) {

      if (e.key === "Escape") setOpenIndex(null)

      if (e.key === "ArrowRight") {
        setOpenIndex((i) => (i + 1) % photos.length)
      }

      if (e.key === "ArrowLeft") {
        setOpenIndex((i) => (i - 1 + photos.length) % photos.length)
      }

    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)

  }, [openIndex, photos.length])

  return (

    <section className="card">


      <h2>
        Gallery
      </h2>


      {loading && (
        <p>Loading gallery...</p>
      )}


      <div className="gallery-grid">


        {!loading && photos.map((photo, index) => (


          <div
            className="gallery-card"
            key={photo["Photo ID"]}
            onClick={() => setOpenIndex(index)}
          >


            <img
              src={photo.Image}
              alt={photo.Caption}
            />

            <div className="gallery-card-zoom-hint">⤢</div>


            <p>
              {photo.Caption}
            </p>


          </div>


        ))}


      </div>

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}


    </section>

  )

}


export default Gallery
