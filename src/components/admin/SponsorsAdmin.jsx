import { useState } from "react"
import { AdminField, AdminImageField } from "./AdminFields"
import { rowFields, useAdminRows } from "./useAdminRows"

// Admin > Sponsors: add or edit ads (Advertisements tab), with images
// from the camera roll and optional start / end dates.

const AD_FIELDS = [
  { name: "Advertisement Title", label: "Sponsor name", wide: true },
  { name: "Store Link", label: "Link (where the ad goes)", wide: true, placeholder: "https://" },
  { name: "Start Date", placeholder: "10/1/26 (optional)" },
  { name: "End Date", placeholder: "12/31/26 (optional)" },
]
const SKIP = ["Advertisement #", "Store Picture Desktop", "Store Picture Mobile"]

function SponsorsAdmin() {
  const { rows, header, loaded, error, save, remove } = useAdminRows("ads")
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const ads = [...rows].sort((a, b) => Number(a.fields["Advertisement #"]) - Number(b.fields["Advertisement #"]))
  const current = selected && selected !== "new" ? rows.find((r) => r.fields["Advertisement #"] === selected) : null
  const formulas = current?.formulas || []
  const fields = rowFields(header, AD_FIELDS, SKIP)

  function open(row) {
    setSelected(row ? row.fields["Advertisement #"] : "new")
    setValues(row ? { ...row.fields } : {})
    setMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const editable = {}
      Object.keys(values).forEach((k) => { if (!formulas.includes(k) && k !== "Advertisement #") editable[k] = values[k] })
      const result = await save(selected === "new" ? "" : selected, editable)
      setSelected(result.key)
      setMessage("Sponsor saved - the site shows it within a few minutes.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the sponsor.")
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!window.confirm(`Remove the "${values["Advertisement Title"]}" ad? Its stats stay until you clear them below.`)) return
    try {
      await remove(selected)
      setSelected(null)
      setMessage("Ad removed.")
    } catch (err) {
      setMessage(err.message || "Couldn't remove the ad.")
    }
  }

  return (
    <div className="adx adx-sponsors">
      <aside className="adx-list">
        <div className="adx-list-head">
          <h3>Sponsors</h3>
          <button type="button" onClick={() => open(null)}>+ Add sponsor</button>
        </div>
        {error && <p className="adx-error">{error}</p>}
        {!loaded && !error && <p className="adx-muted">Loading...</p>}
        {ads.map((r) => (
          <button
            key={r.fields["Advertisement #"]}
            type="button"
            className={`adx-item${selected === r.fields["Advertisement #"] ? " is-active" : ""}`}
            onClick={() => open(r)}
          >
            <b>{(r.fields["Advertisement Title"] || "").trim() || `Ad ${r.fields["Advertisement #"]}`}</b>
            <small>
              {r.fields["Start Date"] || r.fields["End Date"]
                ? `${r.fields["Start Date"] || "now"} – ${r.fields["End Date"] || "no end"}`
                : "Always on"}
            </small>
          </button>
        ))}
      </aside>

      <section className="adx-form">
        {!selected ? (
          <p className="adx-muted">
            Pick a sponsor to edit, or add one. With more than one sponsor running, each visitor sees one of them.
          </p>
        ) : (
          <form onSubmit={submit}>
            <h3>{selected === "new" ? "New sponsor" : values["Advertisement Title"]}</h3>
            <div className="af-grid">
              {fields.map((f) => (
                <AdminField
                  key={f.name}
                  field={f}
                  value={values[f.name]}
                  formula={formulas.includes(f.name)}
                  onChange={(v) => setValues({ ...values, [f.name]: v })}
                />
              ))}
              <AdminImageField
                label="Computer ad (tall)"
                value={values["Store Picture Desktop"]}
                kind="ad"
                title={values["Advertisement Title"]}
                hint="Tall and narrow, about 216 × 656 pixels - shown down the right side on big screens."
                onChange={(url) => setValues({ ...values, "Store Picture Desktop": url })}
              />
              <AdminImageField
                label="Phone ad (wide)"
                value={values["Store Picture Mobile"]}
                kind="ad"
                title={values["Advertisement Title"]}
                hint="Wide and short, about 1457 × 225 pixels - shown along the bottom on phones."
                onChange={(url) => setValues({ ...values, "Store Picture Mobile": url })}
              />
            </div>
            <div className="adx-actions">
              <button type="submit" className="adx-save" disabled={busy || !(values["Store Link"] || "").trim()}>
                {busy ? "Saving..." : selected === "new" ? "Add sponsor" : "Save sponsor"}
              </button>
              {selected !== "new" && <button type="button" className="af-danger" onClick={del}>Remove ad</button>}
              {message && <span className="adx-message">{message}</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default SponsorsAdmin
