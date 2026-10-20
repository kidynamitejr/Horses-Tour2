import { useEffect, useRef, useState } from "react"
import { getNews } from "../data/googleSheets"
import { deleteNews, saveNews } from "../data/liveScoring"
import { shrinkImage } from "../utils/image"

// Admin > News: write an article with a photo from the camera roll, mark
// it Featured (shown on the home page), and edit or delete past articles.
// Saves straight to the sheet's News tab through the Apps Script.

function todayLabel() {
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const EMPTY = { id: "", headline: "", date: "", article: "", image: "", featured: true, image2: "", caption2: "" }

function isFeatured(value) {
  return /^(yes|y|true|x|1)$/i.test((value || "").trim())
}

function NewsAdmin() {
  const fileRef = useRef(null)
  const file2Ref = useRef(null)
  const [articles, setArticles] = useState([])
  const [form, setForm] = useState({ ...EMPTY, date: todayLabel() })
  const [photo, setPhoto] = useState(null)
  const [photo2, setPhoto2] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    getNews()
      .then((rows) => setArticles([...rows].sort((a, b) => Number(b["Article ID"]) - Number(a["Article ID"]))))
      .catch(() => {})
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value })

  const pickPhoto = (setter) => async (e) => {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file) return
    try {
      setter(await shrinkImage(file))
    } catch (err) {
      setMessage(err.message)
    }
  }

  function removePhoto2() {
    setPhoto2(null)
    setForm({ ...form, image2: "", caption2: "" })
  }

  function edit(a) {
    setForm({
      id: a["Article ID"],
      headline: a.Headline || "",
      date: a.Date || "",
      article: a.Article || "",
      image: a.Image || "",
      featured: isFeatured(a.Featured),
      image2: a["Image 2"] || "",
      caption2: a["Image 2 Caption"] || "",
    })
    setPhoto(null)
    setPhoto2(null)
    setMessage("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function startNew() {
    setForm({ ...EMPTY, date: todayLabel() })
    setPhoto(null)
    setPhoto2(null)
    setMessage("")
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      const result = await saveNews({ ...form, imageData: photo?.data || "", imageData2: photo2?.data || "" })
      const saved = {
        "Article ID": result.id,
        Date: form.date,
        Headline: form.headline,
        Image: result.image,
        Article: form.article,
        Featured: form.featured ? "Yes" : "No",
        "Image 2": result.image2 || "",
        "Image 2 Caption": result.image2 ? form.caption2 : "",
      }
      setArticles((list) => [saved, ...list.filter((a) => a["Article ID"] !== result.id)]
        .sort((a, b) => Number(b["Article ID"]) - Number(a["Article ID"])))
      setMessage(form.id
        ? "Article updated - the site shows the change within a few minutes."
        : "Published! It appears on the site within a few minutes.")
      setForm({ ...EMPTY, date: todayLabel() })
      setPhoto(null)
      setPhoto2(null)
    } catch (err) {
      setMessage(err.message || "Couldn't save the article.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.Headline}"? This can't be undone.`)) return
    try {
      await deleteNews(a["Article ID"])
      setArticles((list) => list.filter((x) => x["Article ID"] !== a["Article ID"]))
      if (form.id === a["Article ID"]) startNew()
      setMessage("Article deleted.")
    } catch (err) {
      setMessage(err.message || "Couldn't delete the article.")
    }
  }

  async function toggleFeatured(a) {
    const featured = !isFeatured(a.Featured)
    try {
      await saveNews({
        id: a["Article ID"],
        headline: a.Headline,
        date: a.Date,
        article: a.Article,
        image: a.Image,
        image2: a["Image 2"] || "",
        caption2: a["Image 2 Caption"] || "",
        featured,
      })
      setArticles((list) => list.map((x) => (x["Article ID"] === a["Article ID"] ? { ...x, Featured: featured ? "Yes" : "No" } : x)))
    } catch (err) {
      setMessage(err.message || "Couldn't update the article.")
    }
  }

  const shownImage = photo?.preview || form.image
  const shownImage2 = photo2?.preview || form.image2

  return (
    <div className="nws">
      <form className="nws-form" onSubmit={save}>
        <div className="nws-form-head">
          <h3>{form.id ? "Edit article" : "New article"}</h3>
          {form.id && <button type="button" className="nws-link" onClick={startNew}>+ Write a new one instead</button>}
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto(setPhoto)} />
        <button type="button" className={`nws-photo${shownImage ? " has-photo" : ""}`} onClick={() => fileRef.current?.click()}>
          {shownImage ? <img src={shownImage} alt="" /> : <span>📷 Add a photo from your camera roll</span>}
          {shownImage && <small>Tap to change photo</small>}
        </button>

        <label>
          <span>Headline</span>
          <input type="text" value={form.headline} onChange={set("headline")} maxLength={120} required />
        </label>

        <div className="nws-row">
          <label>
            <span>Date</span>
            <input type="text" value={form.date} onChange={set("date")} placeholder="10/25" maxLength={10} />
          </label>
          <label className="nws-check">
            <input type="checkbox" checked={form.featured} onChange={set("featured")} />
            <span>Featured on the home page</span>
          </label>
        </div>

        <label>
          <span>Article</span>
          <textarea value={form.article} onChange={set("article")} rows={10} />
        </label>

        <div className="nws-second">
          <span className="nws-second-label">Second photo (optional) - shown partway through the article</span>
          <input ref={file2Ref} type="file" accept="image/*" hidden onChange={pickPhoto(setPhoto2)} />
          {shownImage2 ? (
            <div className="nws-second-photo">
              <img src={shownImage2} alt="" />
              <div className="nws-second-actions">
                <button type="button" onClick={() => file2Ref.current?.click()}>Change</button>
                <button type="button" className="nws-delete" onClick={removePhoto2}>Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" className="nws-add-second" onClick={() => file2Ref.current?.click()}>
              + Add a second photo
            </button>
          )}
          {shownImage2 && (
            <label>
              <span>Photo caption</span>
              <input type="text" value={form.caption2} onChange={set("caption2")} maxLength={160} placeholder="e.g. Jacob Dale lines up his putt on 18" />
            </label>
          )}
        </div>

        <button type="submit" className="nws-save" disabled={saving || !form.headline.trim()}>
          {saving ? "Saving..." : form.id ? "Save changes" : "Publish article"}
        </button>
        {message && <p className="nws-message">{message}</p>}
      </form>

      <div className="nws-list">
        <h3>Articles</h3>
        {articles.length === 0 && <p className="nws-empty">No articles yet.</p>}
        {articles.map((a) => (
          <div key={a["Article ID"]} className={`nws-item${form.id === a["Article ID"] ? " is-editing" : ""}`}>
            {a.Image ? <img src={a.Image} alt="" /> : <span className="nws-noimg" />}
            <div className="nws-item-info">
              <b>{a.Headline}</b>
              <small>{a.Date}</small>
            </div>
            <div className="nws-item-actions">
              <button
                type="button"
                className={`nws-star${isFeatured(a.Featured) ? " is-on" : ""}`}
                onClick={() => toggleFeatured(a)}
                aria-label={isFeatured(a.Featured) ? "Remove from home page" : "Feature on home page"}
                title={isFeatured(a.Featured) ? "Featured on the home page" : "Not on the home page"}
              >
                ★
              </button>
              <button type="button" onClick={() => edit(a)}>Edit</button>
              <button type="button" className="nws-delete" onClick={() => remove(a)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NewsAdmin
