import { useEffect, useState } from "react"
import { getAllPars, savePars } from "../../data/liveScoring"
import { AdminField, AdminImageField } from "./AdminFields"
import { rowFields, sheetDate, useAdminRows } from "./useAdminRows"

// Admin > Events: add or edit events (Events tab), upload the Winner
// Picture, and set the course's pars right under the event.

const EVENT_FIELDS = [
  { name: "Event Name", wide: true },
  { name: "Date", placeholder: "10/25/26" },
  { name: "Course", list: "ev-courses", placeholder: "Oak Knoll" },
  { name: "Event Type", type: "select", options: ["Regular", "Major", "Championship", "Exhibition"] },
  { name: "Status", type: "select", options: ["Planned", "Played"] },
  { name: "Tee Time", placeholder: "1:00 PM" },
  { name: "Buy in", placeholder: "$25" },
  { name: "Trophy Cost", placeholder: "$50" },
  { name: "Address", wide: true, placeholder: "Street, City, LA 70000" },
  { name: "Winner", wide: true, placeholder: "Filled in automatically when the round is submitted" },
]
const SKIP = ["Event ID", "Winner Picture"]
const PAR_CHOICES = [3, 4, 5, 6]

function CoursePars({ course, courses, onSaved }) {
  const key = (course || "").trim().toLowerCase()
  const found = courses.find((c) => c.course.toLowerCase() === key)
  const [pars, setPars] = useState(() => found?.pars?.slice(0, 18) || Array(18).fill(4))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  if (!key) return <p className="ev-pars-note">Enter the course to set its pars.</p>

  const total = (holes) => holes.reduce((t, h) => t + (Number(pars[h]) || 0), 0)
  const front = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  const back = [9, 10, 11, 12, 13, 14, 15, 16, 17]

  async function save() {
    setBusy(true)
    setMessage("")
    try {
      await savePars(course.trim(), pars.map(Number))
      setMessage("Pars saved.")
      onSaved()
    } catch (err) {
      setMessage(err.message || "Couldn't save the pars.")
    } finally {
      setBusy(false)
    }
  }

  const nine = (holes, label) => (
    <div className="ev-pars-nine">
      {holes.map((h) => (
        <label key={h}>
          <span>{h + 1}</span>
          <select value={pars[h] || 4} onChange={(e) => setPars(pars.map((v, i) => (i === h ? Number(e.target.value) : v)))}>
            {PAR_CHOICES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      ))}
      <label className="ev-pars-sum"><span>{label}</span><b>{total(holes)}</b></label>
    </div>
  )

  return (
    <div className="ev-pars">
      <div className="ev-pars-head">
        <b>Course pars - {course.trim()}</b>
        <span>{found ? `Par ${total([...front, ...back])}` : "New course - set its pars"}</span>
      </div>
      {nine(front, "Out")}
      {nine(back, "In")}
      <div className="ev-pars-foot">
        <button type="button" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save pars"}</button>
        {message && <span>{message}</span>}
      </div>
    </div>
  )
}

function EventsAdmin() {
  const { rows, header, loaded, error, save, remove } = useAdminRows("events")
  const [courses, setCourses] = useState([])
  const [selected, setSelected] = useState(null) // event ID, "new", or null
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const loadPars = () => getAllPars().then(setCourses).catch(() => {})
  useEffect(() => {
    loadPars()
  }, [])

  const events = [...rows].sort((a, b) => (sheetDate(a.fields.Date) || 0) - (sheetDate(b.fields.Date) || 0))
  const current = selected && selected !== "new" ? rows.find((r) => r.fields["Event ID"] === selected) : null
  const formulas = current?.formulas || []
  const fields = rowFields(header, EVENT_FIELDS, SKIP)

  function open(row) {
    setSelected(row ? row.fields["Event ID"] : "new")
    setValues(row ? { ...row.fields } : { "Event Type": "Regular", Status: "Planned" })
    setMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const editable = {}
      Object.keys(values).forEach((k) => { if (!formulas.includes(k) && k !== "Event ID") editable[k] = values[k] })
      const result = await save(selected === "new" ? "" : selected, editable)
      setSelected(result.key)
      setMessage(selected === "new" ? "Event added." : "Event saved.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the event.")
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!window.confirm(`Delete "${values["Event Name"]}"? Its results in other tabs aren't removed. This can't be undone.`)) return
    try {
      await remove(selected)
      setSelected(null)
      setMessage("Event deleted.")
    } catch (err) {
      setMessage(err.message || "Couldn't delete the event.")
    }
  }

  return (
    <div className="adx">
      <datalist id="ev-courses">
        {courses.map((c) => <option key={c.course} value={c.course} />)}
      </datalist>

      <aside className="adx-list">
        <div className="adx-list-head">
          <h3>Events</h3>
          <button type="button" onClick={() => open(null)}>+ Add event</button>
        </div>
        {error && <p className="adx-error">{error}</p>}
        {!loaded && !error && <p className="adx-muted">Loading...</p>}
        {events.map((r) => (
          <button
            key={r.fields["Event ID"]}
            type="button"
            className={`adx-item${selected === r.fields["Event ID"] ? " is-active" : ""}`}
            onClick={() => open(r)}
          >
            <b>{r.fields["Event Name"] || "Untitled"}</b>
            <small>{r.fields.Date} · {(r.fields.Status || "").trim() || "Planned"}</small>
          </button>
        ))}
      </aside>

      <section className="adx-form">
        {!selected ? (
          <p className="adx-muted">Pick an event to edit, or add a new one.</p>
        ) : (
          <form onSubmit={submit}>
            <h3>{selected === "new" ? "New event" : values["Event Name"]}</h3>
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
              {header.includes("Winner Picture") && (
                formulas.includes("Winner Picture")
                  ? <AdminField field={{ name: "Winner Picture" }} value={values["Winner Picture"]} formula />
                  : (
                    <AdminImageField
                      label="Winner Picture"
                      value={values["Winner Picture"]}
                      kind="winner"
                      title={values["Event Name"]}
                      hint="Shown on the Schedule and in the Hall of Champions."
                      onChange={(url) => setValues({ ...values, "Winner Picture": url })}
                    />
                  )
              )}
            </div>

            <CoursePars key={(values.Course || "").trim().toLowerCase() + courses.length} course={values.Course || ""} courses={courses} onSaved={loadPars} />

            <div className="adx-actions">
              <button type="submit" className="adx-save" disabled={busy}>{busy ? "Saving..." : selected === "new" ? "Add event" : "Save event"}</button>
              {selected !== "new" && <button type="button" className="af-danger" onClick={del}>Delete event</button>}
              {message && <span className="adx-message">{message}</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default EventsAdmin
