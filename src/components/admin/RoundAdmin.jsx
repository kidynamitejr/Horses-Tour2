import { useEffect, useState } from "react"
import { adminSaveCard, flushQueue, submitAll } from "../../data/liveScoring"
import { formatToPar, isSubmitted, isToday, summarizeCard, teamCard, useLiveEvent } from "../../utils/liveEvent"
import { eventDisplayName } from "../../utils/eventName"

// Admin > Round: a game-day dashboard (every team's progress, Submit all)
// and "Fix a scorecard" for any round - even after it's locked - which
// resubmits to Hole by Hole and Match Entry.

const HOLES = Array.from({ length: 18 }, (_, i) => i)

function CardFixer({ live, team, onSaved }) {
  const card = teamCard(live, team)
  const pars = live.pars
  const [strokes, setStrokes] = useState(() => card.strokes.map((s) => (s ? String(s) : "")))
  const [contrib, setContrib] = useState(() => (card.contributions
    ? card.contributions.map((c) => [String(c?.[0] ?? 0), String(c?.[1] ?? 0)])
    : HOLES.map(() => ["", ""])))
  const perHoleTotals = [0, 1].map((i) => contrib.reduce((t, c) => t + (Number(c[i]) || 0), 0))
  const [totals, setTotals] = useState(() => (card.contributionTotals || perHoleTotals).map((v) => String(v ?? 0)))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const filled = strokes.filter((s) => Number(s) > 0).length
  const toPar = pars ? strokes.reduce((t, s, h) => t + (Number(s) > 0 ? Number(s) - pars[h] : 0), 0) : null

  function setHole(h, value) {
    setStrokes(strokes.map((s, i) => (i === h ? value.replace(/\D/g, "").slice(0, 2) : s)))
  }

  function setContribution(h, p, value) {
    const next = contrib.map((c, i) => (i === h ? c.map((v, j) => (j === p ? value.replace(/[^\d.]/g, "").slice(0, 4) : v)) : c))
    setContrib(next)
    setTotals([0, 1].map((i) => String(next.reduce((t, c) => t + (Number(c[i]) || 0), 0))))
  }

  async function save() {
    const note = filled === 18
      ? "Save and resubmit this card to Hole by Hole and Match Entry?"
      : `Only ${filled} of 18 holes have a score - save them to Live Scores without resubmitting?`
    if (!window.confirm(note)) return
    setBusy(true)
    setMessage("")
    try {
      const result = await adminSaveCard({
        event: live.eventId,
        eventName: live.eventName,
        course: live.course,
        team: team.letter,
        players: team.players,
        strokes: strokes.map((s) => Number(s) || 0),
        contributions: contrib.map((c) => c.map((v) => Number(v) || 0)),
        contributionTotals: totals.map((v) => Number(v) || 0),
      })
      setMessage(result.submitted ? "Card fixed and resubmitted." : "Holes saved (card isn't complete, so it wasn't resubmitted).")
      onSaved()
    } catch (err) {
      setMessage(err.message || "Couldn't save the card.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rda-fix">
      <div className="rda-fix-head">
        <b>{team.label} · {team.players.join(" & ")}</b>
        <span>{filled}/18 holes{toPar != null && filled ? ` · ${formatToPar(toPar)}` : ""}</span>
      </div>
      <div className="rda-scroll">
        <table className="rda-table">
          <thead>
            <tr>
              <th>Hole</th>
              {HOLES.map((h) => <th key={h}>{h + 1}</th>)}
            </tr>
            <tr className="rda-par">
              <th>Par</th>
              {HOLES.map((h) => <td key={h}>{pars ? pars[h] : "-"}</td>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Score</th>
              {HOLES.map((h) => (
                <td key={h}>
                  <input inputMode="numeric" value={strokes[h]} onChange={(e) => setHole(h, e.target.value)} aria-label={`Hole ${h + 1} score`} />
                </td>
              ))}
            </tr>
            {team.players.map((name, p) => (
              <tr key={name} className="rda-contrib">
                <th>{name.split(" ")[0]}</th>
                {HOLES.map((h) => (
                  <td key={h}>
                    <input inputMode="decimal" value={contrib[h][p]} onChange={(e) => setContribution(h, p, e.target.value)} aria-label={`${name} hole ${h + 1} contributions`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rda-totals">
        <span>Contribution totals for Match Entry:</span>
        {team.players.map((name, p) => (
          <label key={name}>
            {name}
            <input inputMode="decimal" value={totals[p]} onChange={(e) => setTotals(totals.map((v, i) => (i === p ? e.target.value.replace(/[^\d.]/g, "") : v)))} />
          </label>
        ))}
        <small>These are filled in from the holes above - change them if this round only has totals.</small>
      </div>

      <div className="adx-actions">
        <button type="button" className="adx-save" onClick={save} disabled={busy || !pars}>
          {busy ? "Saving..." : filled === 18 ? "Save & resubmit card" : "Save holes"}
        </button>
        {!pars && <span className="adx-error">Set this course&apos;s pars in Events first.</span>}
        {message && <span className="adx-message">{message}</span>}
      </div>
    </div>
  )
}

function RoundAdmin() {
  const [eventParam, setEventParam] = useState(null)
  const live = useLiveEvent(eventParam)
  const { events, event, eventId, teams, state, pars, refresh, loading } = live
  const [fixTeam, setFixTeam] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  // Keep the dashboard current on game day.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, 20000)
    return () => clearInterval(timer)
  }, [refresh])

  const rows = teams.map((t) => {
    const card = teamCard(live, t)
    const summary = summarizeCard(card, pars)
    // A past round already complete on Hole by Hole counts as final.
    const final = (card.source === "history" && summary.thru === 18) || isSubmitted(state, t)
    return { ...t, ...summary, submitted: final }
  })
  const team = teams.find((t) => t.letter === fixTeam)
  const liveNow = isToday(event)

  async function sendAll() {
    if (!window.confirm("Submit every finished card to Hole by Hole and Match Entry?")) return
    setBusy(true)
    setMessage("")
    try {
      await flushQueue()
      const result = await submitAll({ event: eventId, eventName: live.eventName, course: live.course })
      setMessage(result.submitted.length
        ? `Submitted ${result.submitted.length} card${result.submitted.length === 1 ? "" : "s"}.${result.winner ? ` Winner: ${result.winner}.` : ""}`
        : "No finished cards to submit yet.")
      refresh()
    } catch (err) {
      setMessage(err.message || "Couldn't submit the cards.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rda">
      <div className="rda-head">
        <div>
          <span className={`live-badge${liveNow ? " is-live" : ""}`}>{liveNow ? <><i /> Live today</> : "Round"}</span>
          <h3>{event ? eventDisplayName(event) : loading ? "Loading..." : "No event"}</h3>
          {event && <small>{event.Date} · {event.Course}</small>}
        </div>
        <label className="rda-picker">
          <span>Event</span>
          <select value={eventId} onChange={(e) => { setEventParam(e.target.value); setFixTeam("") }}>
            {events.map((e) => <option key={e["Event ID"]} value={e["Event ID"]}>{eventDisplayName(e)}</option>)}
          </select>
        </label>
      </div>

      <section className="rda-board">
        <div className="rda-board-head">
          <h4>Teams</h4>
          {liveNow && (
            <button type="button" className="adx-save" onClick={sendAll} disabled={busy}>
              {busy ? "Submitting..." : "Submit all finished cards"}
            </button>
          )}
        </div>
        {message && <p className="adx-message">{message}</p>}
        {teams.length === 0 && !loading && <p className="adx-muted">No teams set for this event yet.</p>}
        <div className="rda-teams">
          {rows.map((r) => (
            <div key={r.letter} className={`rda-team${r.submitted ? " is-done" : ""}`}>
              <b>{r.label}</b>
              <span className="rda-names">{r.players.join(" & ")}</span>
              <span className="rda-holes" title={`${r.thru} of 18 holes entered`}>
                <b>{r.thru}/18</b>
                <i><em style={{ width: `${(r.thru / 18) * 100}%` }} /></i>
              </span>
              <span className="rda-progress">
                {r.submitted ? "✓ Final" : r.thru === 18 ? "Finished - not submitted" : r.thru ? `Thru ${r.thru}` : "Not started"}
              </span>
              <span className="rda-score">{r.thru ? formatToPar(r.toPar ?? r.total) : "-"}</span>
              <button type="button" onClick={() => setFixTeam(r.letter)}>Fix card</button>
            </div>
          ))}
        </div>
      </section>

      {team && (
        <section className="rda-board">
          <div className="rda-board-head">
            <h4>Fix a scorecard</h4>
            <button type="button" onClick={() => setFixTeam("")}>Close</button>
          </div>
          <p className="adx-muted">
            Works for any round, even after it&apos;s locked. Saving a full card resubmits it to Hole by Hole and Match Entry.
          </p>
          <CardFixer
            key={`${eventId}-${team.letter}-${state ? 1 : 0}-${live.holeRows.length}-${live.matchEntry.length}-${pars ? 1 : 0}`}
            live={live}
            team={team}
            onSaved={refresh}
          />
        </section>
      )}
    </div>
  )
}

export default RoundAdmin
