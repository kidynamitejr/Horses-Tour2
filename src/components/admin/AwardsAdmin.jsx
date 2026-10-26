import { useEffect, useMemo, useState } from "react"
import { getEvents, getMatchEntry, getPlayers } from "../../data/googleSheets"
import { deleteAward, getAwards, saveAward } from "../../data/liveScoring"
import { getPlayedMatchEntryRows } from "../../utils/matchEntry"
import Headshot from "../Headshot"
import { sheetDate } from "./useAdminRows"

// Admin > Award Points: give a player power points for an event they
// didn't play (a rainout, an excused absence, a ruling). Saved to the
// sheet's Awarded Points tab; the site adds them to the player's Power
// Points on the leaderboard and their profile.

const EMPTY = { id: "", event: "", player: "", points: "", reason: "" }

const norm = (value) => String(value || "").trim().toLowerCase()

function AwardsAdmin() {
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [played, setPlayed] = useState([])
  const [awards, setAwards] = useState(null)
  const [error, setError] = useState("")
  const [values, setValues] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [removing, setRemoving] = useState("")

  useEffect(() => {
    Promise.all([getEvents(), getPlayers(), getMatchEntry()])
      .then(([eventRows, playerRows, entries]) => {
        setEvents(
          eventRows
            .filter((e) => String(e["Event ID"] || "").trim())
            .sort((a, b) => (sheetDate(b.Date) || 0) - (sheetDate(a.Date) || 0))
        )
        setPlayers(playerRows.filter((p) => (p.Name || "").trim()))
        setPlayed(getPlayedMatchEntryRows(entries))
      })
      .catch(() => setError("Couldn't load the events and players."))
    getAwards({ fresh: true })
      .then(setAwards)
      .catch((err) => {
        setAwards([])
        setError(err.message || "Couldn't load awarded points.")
      })
  }, [])

  const eventById = useMemo(() => {
    const map = {}
    events.forEach((e) => { map[String(e["Event ID"]).trim()] = e })
    return map
  }, [events])

  const playerIds = useMemo(() => {
    const map = {}
    players.forEach((p) => { map[norm(p.Name)] = p["Player ID"] })
    return map
  }, [players])

  // The chosen event's field: who played, and the power points they earned.
  const field = useMemo(() => {
    const rows = played.filter((r) => String(r["Event ID"]).trim() === values.event)
    const points = rows.map((r) => parseFloat(r["Power Score Earned"])).filter(Number.isFinite)
    return {
      names: new Set(rows.map((r) => norm(r.Player))),
      low: points.length ? Math.min(...points) : null,
      avg: points.length ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : null,
      high: points.length ? Math.max(...points) : null,
    }
  }, [played, values.event])

  const roster = players
    .map((p) => ({ name: p.Name.trim(), active: /^active$/i.test((p.Active || "").trim()) }))
    .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name))
  const absent = roster.filter((p) => !field.names.has(norm(p.name)))
  const present = roster.filter((p) => field.names.has(norm(p.name)))

  const list = [...(awards || [])].sort((a, b) =>
    (sheetDate(eventById[b.event]?.Date) || 0) - (sheetDate(eventById[a.event]?.Date) || 0) ||
    a.player.localeCompare(b.player)
  )
  const totalPoints = list.reduce((sum, a) => sum + (Number(a.points) || 0), 0)
  const playerCount = new Set(list.map((a) => norm(a.player))).size

  const eventLabel = (id) => {
    const e = eventById[id]
    return e ? (e["Event Name"] || `Event ${id}`).trim() : `Event ${id}`
  }

  const duplicate = !values.id && list.find((a) => a.event === values.event && norm(a.player) === norm(values.player))
  const playedIt = values.player && field.names.has(norm(values.player))
  const points = Number(values.points)
  const ready = values.event && values.player && values.points !== "" && Number.isFinite(points) && points !== 0 && !duplicate

  const set = (name) => (e) => setValues({ ...values, [name]: e.target.value })

  function edit(award) {
    setValues({ id: award.id, event: award.event, player: award.player, points: String(award.points), reason: award.reason })
    setMessage("")
  }

  function reset() {
    setValues(EMPTY)
    setMessage("")
  }

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setMessage("")
    try {
      const award = { ...values, points, reason: values.reason.trim() }
      const result = await saveAward(award)
      const saved = { ...award, id: result.id }
      setAwards((current) => [...(current || []).filter((a) => a.id !== saved.id), saved])
      setValues(EMPTY)
      setMessage(`${values.id ? "Updated" : "Awarded"} ${points > 0 ? "+" : ""}${points} power points to ${award.player}. The leaderboard updates within a couple of minutes.`)
    } catch (err) {
      setMessage(err.message || "Couldn't save.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(award) {
    if (!window.confirm(`Remove ${award.points} power points from ${award.player} for ${eventLabel(award.event)}?`)) return
    setRemoving(award.id)
    setMessage("")
    try {
      await deleteAward(award.id)
      setAwards((current) => current.filter((a) => a.id !== award.id))
      if (values.id === award.id) setValues(EMPTY)
      setMessage(`Removed ${award.player}'s points for ${eventLabel(award.event)}.`)
    } catch (err) {
      setMessage(err.message || "Couldn't remove it.")
    } finally {
      setRemoving("")
    }
  }

  return (
    <div className="awa">
      <header className="awa-head">
        <div>
          <span className="awa-eyebrow">Commissioner</span>
          <h3>Award power points</h3>
          <p className="adx-muted">
            Give a player power points for an event they didn't play: a rainout, an excused absence or a ruling.
            They count toward the Power Points standings and show on the player's profile.
          </p>
        </div>
        <dl className="awa-stats">
          <div><dt>Awards</dt><dd>{awards ? list.length : "–"}</dd></div>
          <div><dt>Points</dt><dd>{awards ? totalPoints : "–"}</dd></div>
          <div><dt>Players</dt><dd>{awards ? playerCount : "–"}</dd></div>
        </dl>
      </header>

      <div className="awa-grid">
        <form className="awa-card awa-form" onSubmit={submit}>
          <div className="awa-card-head">
            <h4>{values.id ? "Edit award" : "New award"}</h4>
            {values.id && <button type="button" className="awa-text-btn" onClick={reset}>Cancel</button>}
          </div>

          <label className="af-field">
            <span>Event</span>
            <select value={values.event} onChange={set("event")} required>
              <option value="">Choose an event</option>
              {events.map((e) => {
                const id = String(e["Event ID"]).trim()
                return <option key={id} value={id}>{(e["Event Name"] || `Event ${id}`).trim()}{e.Date ? ` · ${e.Date}` : ""}</option>
              })}
            </select>
          </label>

          <label className="af-field">
            <span>Player</span>
            <select value={values.player} onChange={set("player")} required>
              <option value="">Choose a player</option>
              {values.event && present.length > 0 ? (
                <>
                  <optgroup label="Didn't play">
                    {absent.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label="Played this event">
                    {present.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </optgroup>
                </>
              ) : (
                roster.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)
              )}
            </select>
          </label>

          {values.player && (
            <div className="awa-player">
              <Headshot id={playerIds[norm(values.player)]} />
              <div>
                <b>{values.player}</b>
                <small>
                  {!values.event ? "Pick the event" : playedIt ? "Played this event - these points add to what they earned" : "Did not play this event"}
                </small>
              </div>
            </div>
          )}

          <label className="af-field">
            <span>Power points</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={values.points}
              onChange={set("points")}
              placeholder="0"
              required
            />
          </label>

          {field.avg !== null && (
            <div className="awa-suggest" aria-label="Quick fill from this event">
              <span>From this event</span>
              {[
                { label: "Lowest", value: field.low },
                { label: "Average", value: field.avg },
                { label: "Highest", value: field.high },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={Number(values.points) === s.value ? "is-active" : ""}
                  onClick={() => setValues({ ...values, points: String(s.value) })}
                >
                  {s.label} <b>{s.value}</b>
                </button>
              ))}
            </div>
          )}

          <label className="af-field">
            <span>Reason <em>optional</em></span>
            <input type="text" value={values.reason} onChange={set("reason")} maxLength={80} placeholder="Excused absence" />
          </label>

          {duplicate && <p className="adx-error">{values.player} already has points for this event. Edit that award instead.</p>}

          <div className="adx-actions">
            <button type="submit" className="adx-save" disabled={busy || !ready}>
              {busy ? "Saving..." : values.id ? "Save changes" : "Award points"}
            </button>
          </div>
          {message && <p className="awa-message" role="status">{message}</p>}
        </form>

        <section className="awa-card awa-ledger">
          <div className="awa-card-head">
            <h4>Awarded points</h4>
          </div>
          {error && <p className="adx-error">{error}</p>}
          {!awards && <p className="adx-muted">Loading...</p>}
          {awards && list.length === 0 && (
            <div className="awa-empty">
              <span aria-hidden="true">🏅</span>
              <p>No points awarded yet.</p>
            </div>
          )}
          {list.length > 0 && (
            <div className="table-scroll">
              <table className="awa-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Event</th>
                    <th className="awa-num">Points</th>
                    <th className="awa-actions-col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className={values.id === a.id ? "is-editing" : ""}>
                      <td>
                        <span className="awa-who">
                          <Headshot id={playerIds[norm(a.player)]} />
                          <b>{a.player}</b>
                        </span>
                      </td>
                      <td>
                        <span className="awa-event">
                          {eventLabel(a.event)}
                          <small>{[eventById[a.event]?.Date, a.reason].filter(Boolean).join(" · ")}</small>
                        </span>
                      </td>
                      <td className="awa-num"><span className="awa-points">{a.points > 0 ? "+" : ""}{a.points}</span></td>
                      <td className="awa-actions-col">
                        <button type="button" onClick={() => edit(a)}>Edit</button>
                        <button type="button" className="af-danger" onClick={() => remove(a)} disabled={removing === a.id}>
                          {removing === a.id ? "..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AwardsAdmin
