import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ContributionSplit, LiveBoardCard } from "../components/LiveBoard"
import { CalendarIcon, MapPinIcon } from "../components/Icons"
import LiveHighlights from "../components/LiveHighlights"
import { PRACTICE_ID, clearPractice, flushQueue, liveScoringReady, submitAll } from "../data/liveScoring"
import { eventDisplayName } from "../utils/eventName"
import {
  isSubmitted,
  isToday,
  parseEventDate,
  summarizeCard,
  teamCard,
  useLiveEvent,
} from "../utils/liveEvent"

const REFRESH_MS = 20000

function sum(values) {
  return values.reduce((a, b) => a + b, 0)
}

function isPast(event) {
  const date = parseEventDate(event?.Date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Boolean(date) && date < today
}

function secondsAgo(date, now) {
  if (!date) return ""
  const s = Math.max(0, Math.round((now - date) / 1000))
  return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

function LiveScoringPage() {
  const [params, setParams] = useSearchParams()
  const live = useLiveEvent(params.get("event"))
  const { events, event, eventId, eventName, course, editable, practice, teams, state, pars, error, loadedAt, refresh } = live
  const [now, setNow] = useState(() => Date.now())
  const [submittingAll, setSubmittingAll] = useState(false)
  const [submitAllMessage, setSubmitAllMessage] = useState("")

  // Refresh the board every 20 seconds while the page is open.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      if (document.visibilityState === "visible") refresh()
    }, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => {
      clearInterval(timer)
      clearInterval(tick)
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


  const rows = teams
    .map((team) => {
      const card = teamCard(live, team)
      const summary = summarizeCard(card, pars)
      // Past rounds without hole scores: use the official final score.
      if (!summary.thru && card.officialToPar != null) {
        Object.assign(summary, { toPar: card.officialToPar, thru: 18, total: pars ? sum(pars) + card.officialToPar : 0 })
      }
      return { ...team, card, ...summary, submitted: card.source === "live" && isSubmitted(state, team) }
    })
    .sort((a, b) => {
      if (!a.thru !== !b.thru) return a.thru ? -1 : 1
      const ap = a.toPar ?? a.total
      const bp = b.toPar ?? b.total
      return ap - bp || b.thru - a.thru
    })

  // Positions with ties ("T2").
  const scoreOf = (r) => (r.thru ? r.toPar ?? r.total : null)
  rows.forEach((r) => {
    const score = scoreOf(r)
    if (score == null) {
      r.pos = "-"
      return
    }
    const first = rows.findIndex((x) => scoreOf(x) === score)
    const tied = rows.filter((x) => scoreOf(x) === score).length > 1
    r.pos = `${tied ? "T" : ""}${first + 1}`
  })

  const labelFor = (letter) => teams.find((t) => t.letter === letter)?.label || `Team ${letter}`

  async function handleSubmitAll() {
    if (!window.confirm(
      "Submit every finished card to Hole by Hole and Match Entry? Teams that already submitted are just updated.",
    )) return
    setSubmittingAll(true)
    setSubmitAllMessage("")
    try {
      await flushQueue()
      const result = await submitAll({ event: eventId, eventName, course })
      const parts = []
      parts.push(result.submitted.length
        ? `Submitted ${result.submitted.map(labelFor).join(", ")}.`
        : "No finished cards to submit yet.")
      if (result.unfinished.length) {
        parts.push(`Not finished: ${result.unfinished.map((u) => `${labelFor(u.team)} (${u.holes} holes)`).join(", ")}.`)
      }
      if (result.winner) parts.push(`Winner entered in Events: ${result.winner}.`)
      if (result.missingPlayers.length) {
        parts.push(`Not found in Match Entry: ${result.missingPlayers.join(", ")} - add them there by hand.`)
      }
      setSubmitAllMessage(parts.join(" "))
      refresh()
    } catch (err) {
      setSubmitAllMessage(err.message || "Couldn't submit the cards.")
    } finally {
      setSubmittingAll(false)
    }
  }

  const liveNow = isToday(event)
  const anyScores = rows.some((r) => r.thru > 0)

  return (
    <div className="live-page">

      <section className="live-head">
        <div className="live-head-main">
          <span className={`live-badge${liveNow && !practice ? " is-live" : ""}${practice ? " is-practice" : ""}`}>
            {practice ? "Practice · not counted" : liveNow ? <><i /> Live</> : "Scorecards"}
          </span>
          <h2>{event ? live.displayName : "Loading..."}</h2>
          {event && (
            <p className="live-meta">
              <span><CalendarIcon size={14} /> {event.Date}</span>
              <span><MapPinIcon size={14} /> {event.Course}</span>
              {pars && <span>Par {pars.reduce((a, b) => a + b, 0)}</span>}
            </p>
          )}
        </div>

        <label className="live-picker">
          <span>Event</span>
          <select
            value={eventId}
            onChange={(e) => {
              setParams({ event: e.target.value })
            }}
          >
            {events.map((e) => (
              <option key={e["Event ID"]} value={e["Event ID"]}>{eventDisplayName(e)}</option>
            ))}
            <option value={PRACTICE_ID}>Practice round (try the cards)</option>
          </select>
        </label>
      </section>

      <LiveHighlights key={eventId} scores={state?.scores} teams={teams} pars={pars} now={now} />

      {event && !pars && state && (
        <p className="live-note">
          Pars for {event.Course.trim()} haven't been added to the Course Pars tab yet, so scores show as strokes.
        </p>
      )}
      {error && <p className="live-note live-note-error">{error}</p>}

      {practice && (
        <div className="live-note live-practice">
          <span>
            Practice round on {event?.Course?.trim()} with the next event's teams. Scores here are only a test -
            they never count and can't be submitted.
          </span>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Clear all practice scores?")) return
              await flushQueue()
              await clearPractice()
              refresh()
            }}
          >
            Clear practice scores
          </button>
        </div>
      )}

      {teams.length > 0 && state && !editable && (
        <p className="live-note">
          🔒 {liveNow || !isPast(event)
            ? `Scorecards open on game day (${event.Date}).`
            : "This round is closed - scores are final and can't be changed."}
        </p>
      )}

      {teams.length > 0 && editable && (
        <section className="live-keep">
          <h3>Keep your team's card</h3>
          <p className="live-keep-note">
            One shared card per team - either player can enter scores and contributions for both of you,
            so the passenger can keep score while the other drives.
          </p>
          <div className="live-keep-grid">
            {teams.map((team) => (
              <Link key={team.letter} to={`/live/${eventId}/${team.letter}`} className="live-keep-btn">
                <b>{team.label}</b>
                <span>{team.players.join(" & ")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="live-board">
        <div className="live-board-head">
          <h3>Scoreboard</h3>
          <span>{loadedAt ? `Updated ${secondsAgo(loadedAt, now)}` : "Loading..."}</span>
        </div>

        {teams.length === 0 && event && (
          <p className="live-empty-row">Teams for this event haven't been set in Match Entry yet.</p>
        )}

        {teams.length > 0 && (
          <LiveBoardCard rows={rows} pars={pars} eventId={eventId} />
        )}

        {teams.length > 0 && !anyScores && (
          <p className="live-empty-row">No scores yet - they'll show up here as teams enter them.</p>
        )}
      </section>

      {editable && !practice && teams.length > 0 && (
        <section className="live-submit-all">
          <div>
            <h3>Finish the event</h3>
            <p>
              Sends every team with all 18 holes entered to Hole by Hole (holes) and Match Entry
              (Team Score and Contributions), and fills in the Winner on the Events tab once
              every team is in - in case anyone forgot to submit.
            </p>
          </div>
          <button type="button" onClick={handleSubmitAll} disabled={submittingAll}>
            {submittingAll ? "Submitting..." : "Submit all finished cards"}
          </button>
          {submitAllMessage && <p className="live-submit-all-msg">{submitAllMessage}</p>}
        </section>
      )}

      {teams.length > 0 && (
        <section className="live-board">
          <div className="live-board-head">
            <h3>Contribution Split</h3>
            <span>Share of each team's shots that counted</span>
          </div>
          <ContributionSplit rows={rows} />
        </section>
      )}

    </div>
  )
}

export default LiveScoringPage
