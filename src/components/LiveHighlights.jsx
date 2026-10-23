import { useEffect, useState } from "react"
import Headshot from "./Headshot"

// A strip of small cards for the big moments of a round: birdies or
// better in green, double bogeys or worse in red, newest first. Each card
// shows the team's headshots so you can tell who it was at a glance.

function describe(strokes, par) {
  const diff = strokes - par
  if (strokes === 1) return { good: true, title: "Ace" }
  if (diff <= -3) return { good: true, title: "Albatross" }
  if (diff === -2) return { good: true, title: "Eagle" }
  if (diff === -1) return { good: true, title: "Birdie" }
  if (diff === 2) return { good: false, title: "Double" }
  if (diff === 3) return { good: false, title: "Triple" }
  if (diff > 3) return { good: false, title: `+${diff}` }
  return null
}

function timeAgo(iso, now) {
  if (!iso) return ""
  const s = Math.max(0, Math.round((now - new Date(iso)) / 1000))
  if (s < 60) return "now"
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`
}

function buildHighlights(scores, teams, pars) {
  if (!pars || !scores) return []
  const byLetter = Object.fromEntries(teams.map((t) => [t.letter, t]))
  return scores
    .filter((s) => byLetter[s.team] && s.strokes && pars[s.hole - 1])
    .map((s) => {
      const par = pars[s.hole - 1]
      const moment = describe(s.strokes, par)
      return moment && {
        ...moment,
        key: `${s.team}-${s.hole}`,
        hole: s.hole,
        toPar: s.strokes - par,
        team: byLetter[s.team],
        updated: s.updated,
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))
}

export default function LiveHighlights({ scores, teams, pars, playerIds, current }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const highlights = buildHighlights(scores, teams, pars)
  if (!highlights.length) return null

  return (
    <section className="lhl" aria-label="Big moments">
      <ul className="lhl-strip">
        {highlights.map((h) => (
          <li
            key={`${h.key}-${h.title}`}
            className={`lhl-chip ${h.good ? "is-good" : "is-bad"}${h.team.letter === current ? " is-mine" : ""}`}
            title={`${h.team.label} (${h.team.players.join(" & ")}): ${h.title} on hole ${h.hole}`}
          >
            <span className="lhl-heads">
              {h.team.players.map((p) => <Headshot key={p} id={playerIds[p]} />)}
            </span>
            <span className="lhl-text">
              <b>{h.title}</b>
              <small>#{h.hole} · {timeAgo(h.updated, now)}</small>
            </span>
            <span className="lhl-badge">{h.toPar > 0 ? `+${h.toPar}` : h.toPar}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
