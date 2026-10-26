import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getMatchEntry, getPlayers } from "../../data/googleSheets"
import { winnerNames } from "../../utils/majors"
import Headshot from "../Headshot"
import { AdminField, AdminImageField } from "./AdminFields"
import { sheetDate, useAdminRows } from "./useAdminRows"

// Admin > Champion Hall: everything the Hall of Champions shows that the
// commissioner sets by hand - each event's champions (the Events tab's
// Winner, normally filled when the last card is in), whether it was a
// major, and the trophy photo. Saves to the Events tab.

const TYPES = ["Regular", "Major", "Championship", "Exhibition"]

function ChampionsAdmin() {
  const { rows, loaded, error, save } = useAdminRows("events")
  const [scorecards, setScorecards] = useState({}) // event ID -> placement-1 names
  const [playerIds, setPlayerIds] = useState({})
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    getMatchEntry()
      .then((entries) => {
        const byEvent = {}
        entries.forEach((row) => {
          if (!row.Player || Number(row.Placement) !== 1) return
          const id = String(row["Event ID"] || "").trim()
          if (!byEvent[id]) byEvent[id] = []
          byEvent[id].push(row.Player.trim())
        })
        setScorecards(byEvent)
      })
      .catch(() => {})
    getPlayers()
      .then((players) => {
        const ids = {}
        players.forEach((p) => { if (p.Name) ids[p.Name.trim()] = p["Player ID"] })
        setPlayerIds(ids)
      })
      .catch(() => {})
  }, [])

  // Played events (or ones with a champion), newest first.
  const events = rows
    .filter((r) => (r.fields.Status || "").trim() === "Played" || r.fields.Winner || scorecards[r.fields["Event ID"]])
    .sort((a, b) => (sheetDate(b.fields.Date) || 0) - (sheetDate(a.fields.Date) || 0))
  const missingPhoto = events.filter((r) => !r.fields["Winner Picture"])
  const shown = filter === "photo" ? missingPhoto : events
  const current = selected ? rows.find((r) => r.fields["Event ID"] === selected) : null
  const formulas = current?.formulas || []
  const fromCards = scorecards[selected] || []
  const champions = winnerNames(values.Winner).length ? winnerNames(values.Winner) : fromCards

  function open(row) {
    setSelected(row.fields["Event ID"])
    setValues({ ...row.fields })
    setMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const editable = {}
      ;["Winner", "Event Type", "Winner Picture"].forEach((k) => {
        if (k in values && !formulas.includes(k)) editable[k] = values[k]
      })
      await save(selected, editable)
      setMessage("Saved - the Hall of Champions updates in a few minutes.")
    } catch (err) {
      setMessage(err.message || "Couldn't save.")
    } finally {
      setBusy(false)
    }
  }

  const set = (name) => (v) => setValues({ ...values, [name]: v })

  return (
    <div className="adx">
      <datalist id="cha-players">
        {Object.keys(playerIds).sort().map((name) => <option key={name} value={name} />)}
      </datalist>

      <aside className="adx-list">
        <div className="adx-list-head">
          <h3>Champions</h3>
          <select className="cha-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show">
            <option value="all">All events</option>
            <option value="photo">Needs a photo ({missingPhoto.length})</option>
          </select>
        </div>
        {error && <p className="adx-error">{error}</p>}
        {!loaded && !error && <p className="adx-muted">Loading...</p>}
        {loaded && shown.length === 0 && <p className="adx-muted">{filter === "photo" ? "Every champion has a photo." : "No events played yet."}</p>}
        {shown.map((r) => {
          const id = r.fields["Event ID"]
          const names = winnerNames(r.fields.Winner).length ? winnerNames(r.fields.Winner) : scorecards[id] || []
          return (
            <button
              key={id}
              type="button"
              className={`adx-item cha-item${selected === id ? " is-active" : ""}`}
              onClick={() => open(r)}
            >
              {r.fields["Winner Picture"]
                ? <img src={r.fields["Winner Picture"]} alt="" />
                : <span className="cha-item-empty" aria-label="No photo">🏆</span>}
              <span>
                <b>{r.fields["Event Name"] || "Untitled"}</b>
                <small>{r.fields.Date}{names.length ? ` · ${names.join(" & ")}` : " · No champion yet"}</small>
              </span>
            </button>
          )
        })}
      </aside>

      <section className="adx-form">
        {!current ? (
          <p className="adx-muted">
            Pick an event to set its champions, mark it a major, or add the trophy photo.
            {" "}<Link to="/hall-of-champions">View the Hall of Champions</Link>
          </p>
        ) : (
          <form onSubmit={submit}>
            <div>
              <h3>{values["Event Name"]}</h3>
              <p className="adx-muted">{values.Date}{values.Course && ` · ${values.Course}`}</p>
            </div>

            <div className="cha-champs">
              {champions.length === 0 && <span className="adx-muted">No champion yet.</span>}
              {champions.map((name) => (
                <span key={name} className={`cha-champ${playerIds[name] ? "" : " is-unknown"}`}>
                  <Headshot id={playerIds[name]} />
                  <b>{name}</b>
                  {!playerIds[name] && <small>Not on the Players tab</small>}
                </span>
              ))}
            </div>

            <div className="af-grid">
              {formulas.includes("Winner") ? (
                <AdminField field={{ name: "Winner", label: "Champions" }} value={values.Winner} formula />
              ) : (
                <label className="af-field af-wide">
                  <span>Champions</span>
                  <input
                    type="text"
                    value={values.Winner || ""}
                    list="cha-players"
                    placeholder="Trent / Logan"
                    onChange={(e) => set("Winner")(e.target.value)}
                  />
                  <small className="cha-hint">
                    Names separated by "/" (a tie: "A / B &amp; C / D"). Filled in automatically when the round is submitted.
                    {fromCards.length > 0 && fromCards.join(" / ") !== (values.Winner || "").trim() && (
                      <>
                        {" "}Scorecards say <b>{fromCards.join(" / ")}</b>.{" "}
                        <button type="button" className="cha-link" onClick={() => set("Winner")(fromCards.join(" / "))}>Use that</button>
                      </>
                    )}
                  </small>
                </label>
              )}
              <AdminField
                field={{ name: "Event Type", type: "select", options: TYPES }}
                value={values["Event Type"]}
                formula={formulas.includes("Event Type")}
                onChange={set("Event Type")}
              />
              {formulas.includes("Winner Picture") ? (
                <AdminField field={{ name: "Winner Picture" }} value={values["Winner Picture"]} formula />
              ) : (
                <AdminImageField
                  label="Trophy photo"
                  value={values["Winner Picture"]}
                  kind="winner"
                  title={values["Event Name"]}
                  hint="The big photo on the champions' card. Tap it in the Hall to enlarge."
                  onChange={set("Winner Picture")}
                />
              )}
            </div>

            <div className="adx-actions">
              <button type="submit" className="adx-save" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
              {message && <span className="adx-message">{message}</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default ChampionsAdmin
