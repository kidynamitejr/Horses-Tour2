import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import LiveScorecardGrid from "../components/LiveScorecardGrid"
import Headshot from "../components/Headshot"
import { CalendarIcon, ChevronDownIcon, MapPinIcon } from "../components/Icons"
import { PRACTICE_ID, clearPractice, flushQueue, liveScoringReady } from "../data/liveScoring"
import {
  formatToPar,
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
  const { events, event, eventId, editable, practice, teams, playerIds, state, pars, error, loadedAt, refresh } = live
  const [open, setOpen] = useState(null)
  const [now, setNow] = useState(() => Date.now())

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

  const submitted = state?.submitted || []

  const rows = teams
    .map((team) => {
      const card = teamCard(live, team)
      const summary = summarizeCard(card, pars)
      // Past rounds without hole scores: use the official final score.
      if (!summary.thru && card.officialToPar != null) {
        Object.assign(summary, { toPar: card.officialToPar, thru: 18, total: pars ? sum(pars) + card.officialToPar : 0 })
      }
      return { ...team, card, ...summary, submitted: card.source === "live" && submitted.includes(team.letter) }
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

  const liveNow = isToday(event)
  const anyScores = rows.some((r) => r.thru > 0)

  return (
    <div className="live-page">

      <section className="live-head">
        <div className="live-head-main">
          <span className={`live-badge${liveNow && !practice ? " is-live" : ""}${practice ? " is-practice" : ""}`}>
            {practice ? "Practice · not counted" : liveNow ? <><i /> Live</> : "Scorecards"}
          </span>
          <h2>{event ? event["Event Name"] : "Loading..."}</h2>
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
              setOpen(null)
              setParams({ event: e.target.value })
            }}
          >
            {events.map((e) => (
              <option key={e["Event ID"]} value={e["Event ID"]}>{e["Event Name"]}</option>
            ))}
            <option value={PRACTICE_ID}>Practice round (try the cards)</option>
          </select>
        </label>
      </section>

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
          <h3>Leaderboard</h3>
          <span>{loadedAt ? `Updated ${secondsAgo(loadedAt, now)}` : "Loading..."}</span>
        </div>

        {teams.length === 0 && event && (
          <p className="live-empty-row">Teams for this event haven't been set in Match Entry yet.</p>
        )}

        {teams.length > 0 && (
          <div className="live-table" role="table" aria-label="Live leaderboard">
            <div className="live-row live-row-head" role="row">
              <span>Pos</span>
              <span>Team</span>
              <span>To Par</span>
              <span>Thru</span>
              <span className="live-col-total">Total</span>
              <span />
            </div>

            {rows.map((r) => {
              const isOpen = open === r.letter
              return (
                <div key={r.letter} className={`live-entry${isOpen ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="live-row"
                    role="row"
                    onClick={() => setOpen(isOpen ? null : r.letter)}
                    aria-expanded={isOpen}
                  >
                    <span className="live-pos">{r.pos}</span>
                    <span className="live-team">
                      <span className="live-heads">
                        {r.players.map((p) => <Headshot key={p} id={playerIds[p]} />)}
                      </span>
                      <span className="live-names">
                        <b>{r.players.join(" / ")}</b>
                        <small>{r.label}{r.submitted ? " · Card submitted" : ""}</small>
                      </span>
                    </span>
                    <span className={`live-topar${r.toPar < 0 ? " is-under" : ""}`}>
                      {r.thru ? formatToPar(r.toPar) : "-"}
                    </span>
                    <span className="live-thru">{r.thru === 18 ? "F" : r.thru || "-"}</span>
                    <span className="live-col-total">{r.total || "-"}</span>
                    <span className="live-chev"><ChevronDownIcon size={16} /></span>
                  </button>

                  {isOpen && (
                    <div className="live-detail">
                      <LiveScorecardGrid
                        pars={pars}
                        strokes={r.card.strokes}
                        players={r.players}
                        contributions={r.card.contributions}
                        contributionTotals={r.card.contributionTotals}
                      />
                      <Link to={`/live/${eventId}/${r.letter}`} className="live-detail-link">
                        {editable ? `Keep score for ${r.label}` : "View full card"} →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {teams.length > 0 && !anyScores && (
          <p className="live-empty-row">No scores yet - they'll show up here as teams enter them.</p>
        )}
      </section>

    </div>
  )
}

export default LiveScoringPage
