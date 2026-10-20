import { useRef, useState } from "react"
import { liveScoringReady, uploadPhoto } from "../data/liveScoring"
import { shrinkImage } from "../utils/image"

// "Add photos" for the Gallery: pick photos from the camera roll (or take
// one), choose the event and an optional caption, and they're shrunk to a
// web-friendly size and saved to the tour's Google Drive + Gallery tab by
// the Apps Script.

const MAX_PHOTOS = 10

function GalleryUpload({ events, defaultEventId, onUploaded }) {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [eventId, setEventId] = useState(null)
  const [caption, setCaption] = useState("")
  const [name, setName] = useState("")
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  if (!liveScoringReady) return null

  const chosenEvent = eventId ?? defaultEventId ?? ""

  function pickFiles(e) {
    const files = [...e.target.files].slice(0, MAX_PHOTOS)
    e.target.value = ""
    setItems(files.map((file) => ({ file, status: "ready", preview: URL.createObjectURL(file) })))
  }

  async function upload() {
    setBusy(true)
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue
      setItems((list) => list.map((it, j) => (j === i ? { ...it, status: "uploading" } : it)))
      try {
        const { data } = await shrinkImage(items[i].file)
        const result = await uploadPhoto({ data, mimeType: "image/jpeg", event: chosenEvent, caption: caption.trim(), uploader: name.trim() })
        onUploaded({ "Photo ID": String(result.photo.id), "Event ID": chosenEvent, Image: result.photo.url, Caption: caption.trim() })
        setItems((list) => list.map((it, j) => (j === i ? { ...it, status: "done" } : it)))
      } catch (err) {
        const error = /unknown action/i.test(err.message) ? "Uploads aren't switched on yet" : err.message
        setItems((list) => list.map((it, j) => (j === i ? { ...it, status: "error", error } : it)))
      }
    }
    setBusy(false)
  }

  const done = items.length > 0 && items.every((it) => it.status === "done")

  if (!open) {
    return (
      <button type="button" className="gup-open" onClick={() => setOpen(true)}>
        📷 Add photos
      </button>
    )
  }

  return (
    <div className="gup">
      <div className="gup-head">
        <h3>Share your photos</h3>
        <button type="button" className="gup-close" onClick={() => { setOpen(false); setItems([]) }} aria-label="Close">×</button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
      <button type="button" className="gup-pick" onClick={() => inputRef.current?.click()} disabled={busy}>
        {items.length ? "Choose different photos" : "Choose from camera roll"}
      </button>

      {items.length > 0 && (
        <ul className="gup-list">
          {items.map((it, i) => (
            <li key={i} className={`is-${it.status}`}>
              <img src={it.preview} alt="" />
              <span>
                {it.status === "ready" && "Ready"}
                {it.status === "uploading" && "Uploading..."}
                {it.status === "done" && "✓ Added"}
                {it.status === "error" && (it.error || "Didn't upload")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="gup-fields">
        <label>
          <span>Event</span>
          <select value={chosenEvent} onChange={(e) => setEventId(e.target.value)} disabled={busy}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Caption (optional)</span>
          <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} disabled={busy} />
        </label>
        <label>
          <span>Your name (optional)</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} disabled={busy} />
        </label>
      </div>

      <button type="button" className="gup-send" onClick={upload} disabled={busy || items.length === 0 || done}>
        {busy ? "Uploading..." : done ? "All added!" : `Upload ${items.length || ""} photo${items.length === 1 ? "" : "s"}`}
      </button>
      <p className="gup-note">Up to {MAX_PHOTOS} at a time. New photos show here right away and for everyone within a few minutes.</p>
    </div>
  )
}

export default GalleryUpload
