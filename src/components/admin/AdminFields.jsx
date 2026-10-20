import { useRef, useState } from "react"
import { uploadAsset } from "../../data/liveScoring"
import { shrinkImage } from "../../utils/image"

// Form fields for the Admin editors. A column that holds a formula on the
// sheet is shown read-only ("auto"), since saving never overwrites it.

export function AdminField({ field, value, formula, onChange }) {
  const label = field.label || field.name

  if (formula) {
    return (
      <label className="af-field af-auto">
        <span>{label} <em>auto</em></span>
        <output>{value || "-"}</output>
      </label>
    )
  }

  if (field.type === "select") {
    return (
      <label className="af-field">
        <span>{label}</span>
        <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
          {!field.options.includes(value || "") && <option value={value || ""}>{value || "-"}</option>}
          {field.options.map((o) => <option key={o} value={o}>{o || "-"}</option>)}
        </select>
      </label>
    )
  }

  if (field.type === "textarea") {
    return (
      <label className="af-field af-wide">
        <span>{label}</span>
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={field.rows || 4} />
      </label>
    )
  }

  return (
    <label className={`af-field${field.wide ? " af-wide" : ""}`}>
      <span>{label}</span>
      <input
        type="text"
        value={value || ""}
        placeholder={field.placeholder || ""}
        list={field.list}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// A photo field: shows the current image and uploads a new one from the
// camera roll (to the repo's uploads/ folder), putting its link in the row.
export function AdminImageField({ label, value, kind, title, hint, onChange }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const { data } = await shrinkImage(file)
      const result = await uploadAsset({ kind, data, title })
      onChange(result.url)
    } catch (err) {
      setError(err.message || "Couldn't upload the photo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="af-field af-wide af-image">
      <span>{label}</span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      <div className="af-image-row">
        {value ? <img src={value} alt="" /> : <span className="af-image-empty">No photo</span>}
        <div className="af-image-actions">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? "Uploading..." : value ? "Change photo" : "📷 Add photo"}
          </button>
          {value && !busy && <button type="button" className="af-danger" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      {hint && <small>{hint}</small>}
      {error && <small className="af-error">{error}</small>}
    </div>
  )
}
