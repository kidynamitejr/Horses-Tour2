import { useEffect, useState } from "react"
import { getSettings, saveSettings } from "../../data/liveScoring"

// Admin > Banner: a message shown across the top of every page until you
// turn it off (e.g. "Tee time moved to 1:30").

const STYLES = [
  { id: "info", label: "Info (blue)" },
  { id: "warning", label: "Heads up (gold)" },
  { id: "urgent", label: "Urgent (red)" },
]

function BannerAdmin() {
  const [values, setValues] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    getSettings({ fresh: true })
      .then((s) => setValues({
        text: s.announcement_text || "",
        on: s.announcement_on === "yes",
        style: s.announcement_style || "info",
        link: s.announcement_link || "",
      }))
      .catch(() => setValues({ text: "", on: false, style: "info", link: "" }))
  }, [])

  if (!values) return <p className="adx-muted">Loading...</p>

  async function save(on) {
    setBusy(true)
    setMessage("")
    try {
      const next = { ...values, on }
      await saveSettings({
        announcement_text: next.text.trim(),
        announcement_on: next.on ? "yes" : "no",
        announcement_style: next.style,
        announcement_link: next.link.trim(),
      })
      setValues(next)
      setMessage(next.on ? "Banner is live - everyone sees it within a couple of minutes." : "Banner turned off.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the banner.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bna">
      <h3>Announcement banner</h3>
      <p className="adx-muted">Shown across the top of every page. Visitors can close it until the message changes.</p>

      <div className={`site-announcement is-${values.style} bna-preview`}>
        <div className="sa-marquee">
          <div className="sa-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="sa-item">
                {values.text || "Your message here"}
                {values.link && <b>Learn more →</b>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <label className="af-field af-wide">
        <span>Message</span>
        <input type="text" value={values.text} maxLength={160} placeholder="⛈ Tee time moved to 1:30 PM" onChange={(e) => setValues({ ...values, text: e.target.value })} />
      </label>
      <label className="af-field af-wide">
        <span>Link (optional)</span>
        <input type="text" value={values.link} placeholder="https:// or /schedule" onChange={(e) => setValues({ ...values, link: e.target.value })} />
      </label>
      <div className="bna-styles" role="radiogroup" aria-label="Banner style">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={values.style === s.id}
            className={`bna-style is-${s.id}${values.style === s.id ? " is-active" : ""}`}
            onClick={() => setValues({ ...values, style: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="adx-actions">
        <button type="button" className="adx-save" onClick={() => save(true)} disabled={busy || !values.text.trim()}>
          {busy ? "Saving..." : values.on ? "Update banner" : "Turn banner on"}
        </button>
        {values.on && <button type="button" className="af-danger" onClick={() => save(false)} disabled={busy}>Turn off</button>}
        <span className="adx-message">{message || (values.on ? "● Banner is on" : "Banner is off")}</span>
      </div>
    </div>
  )
}

export default BannerAdmin
