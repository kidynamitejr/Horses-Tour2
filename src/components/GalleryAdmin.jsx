import { useEffect, useState } from "react"
import { getEvents, getGallery } from "../data/googleSheets"
import { deletePhoto } from "../data/liveScoring"

// Admin > Gallery: every photo, newest first, with Delete. Deleting removes
// the photo's row from the Gallery tab and deletes the photo file.

function GalleryAdmin() {
  const [photos, setPhotos] = useState(null)
  const [eventNames, setEventNames] = useState({})
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    getGallery()
      .then((rows) => setPhotos([...rows].filter((p) => p.Image).reverse()))
      .catch(() => setPhotos([]))
    getEvents()
      .then((rows) => {
        const names = {}
        rows.forEach((e) => { names[e["Event ID"]] = (e["Event Name"] || "").trim() })
        setEventNames(names)
      })
      .catch(() => {})
  }, [])

  async function remove(photo) {
    const label = (photo.Caption || "").trim() || `photo #${photo["Photo ID"]}`
    if (!window.confirm(`Delete "${label}"? It's removed from the Gallery and the file is deleted. This can't be undone.`)) return
    setBusy(photo["Photo ID"])
    setMessage("")
    try {
      await deletePhoto(photo["Photo ID"])
      setPhotos((list) => list.filter((p) => p["Photo ID"] !== photo["Photo ID"]))
      setMessage("Photo deleted - it disappears from the site within a few minutes.")
    } catch (err) {
      setMessage(err.message || "Couldn't delete the photo.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="gad">
      <div className="gad-head">
        <h3>Gallery photos</h3>
        <span>{photos ? `${photos.length} photos · newest first` : "Loading..."}</span>
      </div>
      {message && <p className="gad-message">{message}</p>}
      {photos && photos.length === 0 && <p className="gad-empty">No photos yet.</p>}

      <div className="gad-grid">
        {(photos || []).map((p) => (
          <div key={p["Photo ID"]} className="gad-item">
            <img src={p.Image} alt={p.Caption || ""} loading="lazy" />
            <div className="gad-info">
              <b>{(p.Caption || "").trim() || "No caption"}</b>
              <small>{eventNames[p["Event ID"]] || (p["Event ID"] ? `Event ${p["Event ID"]}` : "General")} · #{p["Photo ID"]}</small>
            </div>
            <button type="button" onClick={() => remove(p)} disabled={busy === p["Photo ID"]}>
              {busy === p["Photo ID"] ? "Deleting..." : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GalleryAdmin
