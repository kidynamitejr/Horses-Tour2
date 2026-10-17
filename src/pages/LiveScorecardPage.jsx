import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import Headshot from "../components/Headshot"
import LiveScorecardGrid from "../components/LiveScorecardGrid"
import { flushQueue, liveScoringReady, pendingSaves, saveHole, submitCard, takeRejection } from "../data/liveScoring"
import { formatToPar, parseEventDate, summarizeCard, teamCard, useLiveEvent } from "../utils/liveEvent"

const RETRY_MS = 15000

const RESULT_NAMES = { "-3": "Albatross", "-2": "Eagle", "-1": "Birdie", 0: "Par", 1: "Bogey", 2: "Double bogey", 3: "Triple bogey" }

function resultName(strokes, par) {
  if (!par) return ""
  if (strokes === 1) return "Hole in one!"
  const diff = strokes - par
  return RESULT_NAMES[diff] || `+${diff}`
}

function Stepper({ value, onChange, step = 1, min = 0, max = 15, size = "lg", label }) {
  return (
    <div className={`lsc-stepper lsc-stepper-${size}`}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Less ${label}`}>
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  )
}

// The entry panel for one hole. It's re-mounted (via key) whenever the
// selected hole changes, so its draft starts from that hole's saved score.
function HoleEditor({ hole, par, players, playerIds, saved, onSave, onClear }) {
  const [strokes, setStrokes] = useState(saved.strokes || par || 4)
  const [contributions, setContributions] = useState(saved.contributions || [0, 0])

  const setContribution = (index, value) => {
    setContributions((c) => c.map((v, i) => (i === index ? value : v)))
  }

  return (
    <section className="lsc-editor">
      <div className="lsc-editor-head">
        <div>
          <span className="lsc-editor-eyebrow">Hole</span>
          <b className="lsc-editor-hole">{hole + 1}</b>
        </div>
        <div className="lsc-editor-par">
          <span>Par</span>
          <b>{par || "-"}</b>
        </div>
      </div>

      <div className="lsc-editor-score">
        <span className="lsc-editor-label">Team score</span>
        <Stepper value={strokes} onChange={setStrokes} min={1} max={15} label="strokes" />
        <span className="lsc-editor-result">{resultName(strokes, par)}</span>
      </div>

      <div className="lsc-editor-contrib">
        <span className="lsc-editor-label">Shot contributions</span>
        <p>How many of the team's shots on this hole came from each player.</p>
        {players.map((name, i) => (
          <div key={name} className="lsc-contrib-row">
            <span className="lsc-contrib-player">
              <Headshot id={playerIds[name]} />
              {name}
            </span>
            <Stepper
              value={contributions[i] || 0}
              onChange={(v) => setContribution(i, v)}
              step={0.5}
              max={strokes}
              size="sm"
              label={`${name} contributions`}
            />
          </div>
        ))}
      </div>

      <button type="button" className="lsc-save" onClick={() => onSave({ strokes, contributions })}>
        Save hole {hole + 1}
      </button>
      {saved.strokes ? (
        <button type="button" className="lsc-clear" onClick={onClear}>Clear this hole</button>
      ) : null}
    </section>
  )
}

function LiveScorecardPage() {
  const { eventId, team: letter } = useParams()
  const live = useLiveEvent(eventId)
  const { event, course, eventName, date, editable, teams, playerIds, state, pars, error, refresh } = live
  const team = teams.find((t) => t.letter === letter)

  const [selected, setSelected] = useState(null)
  const [version, setVersion] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  // Re-send anything queued (no signal) every 15 seconds and when the
  // phone comes back online, then pick up the teammate's entries too.
  useEffect(() => {
    const retry = () => flushQueue().then(() => {
      const refused = takeRejection()
      if (refused) setMessage(refused)
      setVersion((v) => v + 1)
      return refresh()
    })
    const timer = setInterval(retry, RETRY_MS)
    window.addEventListener("online", retry)
    document.addEventListener("visibilitychange", retry)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", retry)
      document.removeEventListener("visibilitychange", retry)
    }
  }, [refresh])

  if (!liveScoringReady) {
    return (
      <div className="live-page">
        <section className="live-empty">
          <h2>Live scoring is almost ready</h2>
          <p>Scorecards will open here once live scoring is connected to the tour's Google Sheet.</p>
        </section>
      </div>
    )
  }

  if (!event || !team) {
    return (
      <div className="live-page">
        <p className="live-empty-row">{live.loading || teams.length === 0 ? "Loading scorecard..." : "This team isn't in this event."}</p>
        <Link to="/live" className="lsc-back">← Live leaderboard</Link>
      </div>
    )
  }

  const card = teamCard(state, eventId, letter)
  const summary = summarizeCard(card, pars)
  const firstEmpty = card.strokes.findIndex((s) => !s)
  const hole = selected ?? (firstEmpty === -1 ? 17 : firstEmpty)
  const pending = pendingSaves(eventId, letter).length
  const submitted = (state?.submitted || []).includes(letter)
  const complete = firstEmpty === -1

  const contributionTotals = [0, 1].map((i) => card.contributions.reduce((t, c) => t + (Number(c[i]) || 0), 0))
  const contributionSum = contributionTotals[0] + contributionTotals[1]

  const basePayload = { event: eventId, team: letter, course, date, players: team.players }

  // Scores can only be changed on game day - the Google script enforces
  // this too, so a locked card can't be edited from anywhere.
  const eventDay = parseEventDate(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = eventDay && eventDay > today

  function save({ strokes, contributions }) {
    setMessage("")
    const done = saveHole({ ...basePayload, hole: hole + 1, strokes, contributions })
    setVersion((v) => v + 1)
    // Move on to the next hole that still needs a score.
    const next = card.strokes.findIndex((s, i) => !s && i !== hole)
    setSelected(next === -1 ? hole : next)
    done.then(() => {
      const refused = takeRejection()
      if (refused) setMessage(refused)
      setVersion((v) => v + 1)
      refresh()
    })
  }

  function clear() {
    saveHole({ ...basePayload, hole: hole + 1, strokes: null, contributions: [0, 0] })
      .then(() => refresh())
    setVersion((v) => v + 1)
  }

  async function submit() {
    if (!window.confirm(`Submit ${team.label}'s final card? It will be added to the Hole by Hole results.`)) return
    setSubmitting(true)
    setMessage("")
    try {
      const left = await flushQueue()
      if (left > 0) throw new Error("Some holes haven't sent yet - try again when you have signal.")
      await submitCard({ ...basePayload, eventName })
      await refresh()
      setMessage("Card submitted. Nice round!")
    } catch (err) {
      setMessage(err.message || "Couldn't submit the card.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="live-page lsc-page" data-version={version}>

      <Link to={`/live?event=${eventId}`} className="lsc-back">← Live leaderboard</Link>

      <section className="lsc-team">
        <div className="lsc-team-heads">
          {team.players.map((p) => <Headshot key={p} id={playerIds[p]} />)}
        </div>
        <div className="lsc-team-info">
          <span>{team.label} · {eventName}</span>
          <h2>{team.players.join(" & ")}</h2>
        </div>
        <div className="lsc-team-score">
          <b className={summary.toPar < 0 ? "is-under" : ""}>{summary.thru ? formatToPar(summary.toPar ?? summary.total) : "E"}</b>
          <span>{summary.thru === 18 ? "Final" : `Thru ${summary.thru}`}</span>
        </div>
      </section>

      {editable ? (
        <p className="lsc-shared">
          Shared team card · {team.players.map((p) => p.split(" ")[0]).join(" and ")} can both update any hole. Tap a hole to edit it.
        </p>
      ) : state ? (
        <p className="lsc-locked">
          🔒 {upcoming
            ? `This card opens on game day (${date}).`
            : "This round is closed - scores are final and can't be changed."}
        </p>
      ) : null}

      <LiveScorecardGrid
        pars={pars}
        strokes={card.strokes}
        selected={editable ? hole : null}
        onSelect={editable ? setSelected : null}
      />

      {editable && <p className={`lsc-sync${pending ? " is-pending" : ""}`}>
        {error
          ? error
          : pending
            ? `${pending} hole${pending > 1 ? "s" : ""} waiting to send - will keep retrying`
            : "All scores saved"}
      </p>}

      {message && !editable && <p className="lsc-message">{message}</p>}

      {editable && <HoleEditor
        key={`${hole}-${card.strokes[hole] ?? "x"}`}
        hole={hole}
        par={pars?.[hole]}
        players={team.players}
        playerIds={playerIds}
        saved={{ strokes: card.strokes[hole], contributions: card.contributions[hole] }}
        onSave={save}
        onClear={clear}
      />}

      <section className="lsc-totals">
        <h3>Contributions</h3>
        {team.players.map((name, i) => (
          <div key={name} className="lsc-total-row">
            <span>{name}</span>
            <b>{contributionTotals[i]}</b>
            <small>{contributionSum ? `${Math.round((contributionTotals[i] / contributionSum) * 100)}%` : "-"}</small>
          </div>
        ))}
      </section>

      {editable && <section className="lsc-submit">
        {submitted && <p className="lsc-submitted">✓ Card submitted to Hole by Hole{complete ? " - resubmit if you fix a hole" : ""}</p>}
        <button type="button" className="lsc-submit-btn" disabled={!complete || !pars || submitting} onClick={submit}>
          {submitting ? "Submitting..." : submitted ? "Resubmit final card" : "Submit final card"}
        </button>
        {!complete && <small>Enter all 18 holes to submit.</small>}
        {complete && !pars && <small>Pars for this course need to be added before submitting.</small>}
        {message && <p className="lsc-message">{message}</p>}
      </section>}

    </div>
  )
}

export default LiveScorecardPage
