import { useState } from "react"
import { useAdminRows } from "./useAdminRows"

// Admin > Rules: edit, add and delete rules (Rules tab), grouped by
// category like the Rules page.

function RulesAdmin() {
  const { rows, loaded, error, save, remove } = useAdminRows("rules")
  const [editing, setEditing] = useState(null) // rule # or "new"
  const [values, setValues] = useState({ Category: "", Rule: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const rules = [...rows].sort((a, b) => Number(a.fields["Rule #"]) - Number(b.fields["Rule #"]))
  const categories = [...new Set(rules.map((r) => (r.fields.Category || "General").trim()))]

  function open(row, category = "") {
    setEditing(row ? row.fields["Rule #"] : "new")
    setValues(row ? { Category: row.fields.Category, Rule: row.fields.Rule } : { Category: category, Rule: "" })
    setMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      await save(editing === "new" ? "" : editing, { Category: values.Category.trim(), Rule: values.Rule.trim() })
      setEditing(null)
      setMessage("Rule saved - the Rules page updates within a few minutes.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the rule.")
    } finally {
      setBusy(false)
    }
  }

  async function del(row) {
    if (!window.confirm("Delete this rule? This can't be undone.")) return
    try {
      await remove(row.fields["Rule #"])
      setMessage("Rule deleted.")
    } catch (err) {
      setMessage(err.message || "Couldn't delete the rule.")
    }
  }

  const form = (
    <form className="rla-form" onSubmit={submit}>
      <label>
        <span>Category</span>
        <input type="text" value={values.Category} list="rla-categories" onChange={(e) => setValues({ ...values, Category: e.target.value })} required />
      </label>
      <label>
        <span>Rule</span>
        <textarea value={values.Rule} rows={3} onChange={(e) => setValues({ ...values, Rule: e.target.value })} required />
      </label>
      <div className="adx-actions">
        <button type="submit" className="adx-save" disabled={busy}>{busy ? "Saving..." : "Save rule"}</button>
        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>
  )

  return (
    <div className="rla">
      <datalist id="rla-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="adx-list-head">
        <h3>Rules</h3>
        <button type="button" onClick={() => open(null)}>+ Add rule</button>
      </div>
      {error && <p className="adx-error">{error}</p>}
      {!loaded && !error && <p className="adx-muted">Loading...</p>}
      {message && <p className="adx-message">{message}</p>}
      {editing === "new" && form}

      {categories.map((cat) => (
        <section key={cat} className="rla-cat">
          <div className="rla-cat-head">
            <h4>{cat}</h4>
            <button type="button" onClick={() => open(null, cat)}>+ Add to {cat}</button>
          </div>
          {rules.filter((r) => (r.fields.Category || "General").trim() === cat).map((r) => (
            editing === r.fields["Rule #"] ? (
              <div key={r.fields["Rule #"]}>{form}</div>
            ) : (
              <div key={r.fields["Rule #"]} className="rla-rule">
                <p>{(r.fields.Rule || "").replace(/\s+/g, " ").trim()}</p>
                <div>
                  <button type="button" onClick={() => open(r)}>Edit</button>
                  <button type="button" className="af-danger" onClick={() => del(r)}>Delete</button>
                </div>
              </div>
            )
          ))}
        </section>
      ))}
    </div>
  )
}

export default RulesAdmin
