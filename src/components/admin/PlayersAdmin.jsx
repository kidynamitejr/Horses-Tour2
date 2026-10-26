import { useRef, useState } from "react"
import { uploadAsset } from "../../data/liveScoring"
import { headshotUrl, nextPlayerImage } from "../../utils/headshot"
import { makeCutout, shrinkImage } from "../../utils/image"
import { AdminField } from "./AdminFields"
import { rowFields, useAdminRows } from "./useAdminRows"

// Admin > Players: add or edit players (Players tab) and upload their
// headshot - the photo and its cut-out go in the repo's uploads/players/
// folder, like Gallery photos.

const PLAYER_FIELDS = [
  { name: "Name", wide: true },
  { name: "Active", type: "select", options: ["Active", "Inactive"] },
  { name: "Join Date", placeholder: "June 2026" },
  { name: "Date Born", placeholder: "Aug 9, 2000" },
  { name: "Home Course", wide: true, placeholder: "Copper Mill Golf Course" },
]
const SKIP = ["Player ID", "Headshot"]

// Tries the uploads/ copy, then the website's older copy, then says "No photo".
function Headshot({ id }) {
  const [src, setSrc] = useState(headshotUrl(id))
  const failed = src.includes("/default.")
  if (!id || failed) return <span className="pl-photo pl-photo-empty">No photo</span>
  return <img className="pl-photo" src={src} alt="" onError={() => setSrc(nextPlayerImage)} />
}

function PlayersAdmin() {
  const { rows, header, loaded, error, save, remove } = useAdminRows("players")
  const fileRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [photoMessage, setPhotoMessage] = useState("")
  const [photoPreview, setPhotoPreview] = useState("")

  const players = [...rows].sort((a, b) => Number(a.fields["Player ID"]) - Number(b.fields["Player ID"]))
  const current = selected && selected !== "new" ? rows.find((r) => r.fields["Player ID"] === selected) : null
  const formulas = current?.formulas || []
  const fields = rowFields(header, PLAYER_FIELDS, SKIP)

  function open(row) {
    setSelected(row ? row.fields["Player ID"] : "new")
    setValues(row ? { ...row.fields } : { Active: "Active" })
    setMessage("")
    setPhotoPreview("")
    setPhotoMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    const renamed = current && (current.fields.Name || "").trim() !== (values.Name || "").trim()
    if (renamed && !window.confirm(
      "Renaming only changes the Players tab - past results in Match Entry and Hole by Hole keep the old name. Rename anyway?",
    )) return
    setBusy("save")
    setMessage("")
    try {
      const editable = {}
      Object.keys(values).forEach((k) => { if (!formulas.includes(k) && !SKIP.includes(k)) editable[k] = values[k] })
      const result = await save(selected === "new" ? "" : selected, editable)
      setSelected(result.key)
      setMessage(selected === "new" ? "Player added - you can add their photo now." : "Player saved.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the player.")
    } finally {
      setBusy("")
    }
  }

  async function pickPhoto(e) {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file || !selected || selected === "new") return
    setBusy("photo")
    setPhotoMessage("")
    try {
      const [{ data, preview }, cutout] = await Promise.all([shrinkImage(file, 900), makeCutout(file)])
      await uploadAsset({ kind: "headshot", playerId: selected, data, cutout })
      setPhotoPreview(preview)
      setPhotoMessage("Photo saved - it shows on the site within a few minutes.")
    } catch (err) {
      setPhotoMessage(err.message || "Couldn't save the photo.")
    } finally {
      setBusy("")
    }
  }

  async function del() {
    if (!window.confirm(`Delete ${values.Name}? Their past results stay in the other tabs. This can't be undone.`)) return
    try {
      await remove(selected)
      setSelected(null)
      setMessage("Player deleted.")
    } catch (err) {
      setMessage(err.message || "Couldn't delete the player.")
    }
  }

  return (
    <div className="adx">
      <aside className="adx-list">
        <div className="adx-list-head">
          <h3>Players</h3>
          <button type="button" onClick={() => open(null)}>+ Add player</button>
        </div>
        {error && <p className="adx-error">{error}</p>}
        {!loaded && !error && <p className="adx-muted">Loading...</p>}
        {players.map((r) => (
          <button
            key={r.fields["Player ID"]}
            type="button"
            className={`adx-item${selected === r.fields["Player ID"] ? " is-active" : ""}`}
            onClick={() => open(r)}
          >
            <b>{r.fields.Name || "Unnamed"}</b>
            <small>#{r.fields["Player ID"]} · {(r.fields.Active || "").trim() || "-"}</small>
          </button>
        ))}
      </aside>

      <section className="adx-form">
        {!selected ? (
          <p className="adx-muted">Pick a player to edit, or add a new one.</p>
        ) : (
          <form onSubmit={submit}>
            <h3>{selected === "new" ? "New player" : values.Name}</h3>

            {selected !== "new" && (
              <div className="pl-photo-row">
                {photoPreview ? <img className="pl-photo" src={photoPreview} alt="" /> : <Headshot key={selected} id={selected} />}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
                    {busy === "photo" ? "Saving photo..." : "📷 Upload headshot"}
                  </button>
                  <small>A photo on a plain white background works best - the cut-out is made automatically.</small>
                  {photoMessage && <p className="adx-message">{photoMessage}</p>}
                </div>
              </div>
            )}

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
            </div>

            <div className="adx-actions">
              <button type="submit" className="adx-save" disabled={busy === "save" || !(values.Name || "").trim()}>
                {busy === "save" ? "Saving..." : selected === "new" ? "Add player" : "Save player"}
              </button>
              {selected !== "new" && <button type="button" className="af-danger" onClick={del}>Delete player</button>}
              {message && <span className="adx-message">{message}</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default PlayersAdmin
