import { useState } from "react"

// Banners for the big moments of a round: birdies or better in one
// colour, double bogeys or worse in another, newest first.

const SHOWN = 4

function describe(strokes, par, hole) {
  const diff = strokes - par
  if (strokes === 1) return { good: true, icon: "🎯", title: "Hole in one!", text: `made a hole in one on hole ${hole}` }
  if (diff <= -3) return { good: true, icon: "🦅", title: "Albatross!", text: `made an albatross on hole ${hole}` }
  if (diff === -2) return { good: true, icon: "🦅", title: "Eagle!", text: `made an eagle on hole ${hole}` }
  if (diff === -1) return { good: true, icon: "🐦", title: "Birdie", text: `made a birdie on hole ${hole}` }
  if (diff === 2) return { good: false, icon: "😬", title: "Double bogey", text: `double bogeyed hole ${hole}` }
  if (diff === 3) return { good: false, icon: "💥", title: "Triple bogey", text: `triple bogeyed hole ${hole}` }
  if (diff > 3) return { good: false, icon: "💀", title: `+${diff}`, text: `went +${diff} on hole ${hole}` }
  return null
}

function timeAgo(iso, now) {
  if (!iso) return ""
  const s = Math.max(0, Math.round((now - new Date(iso)) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
}

function firstNames(players) {
  return players.map((p) => p.split(" ")[0]).join(" & ")
}

function buildHighlights(scores, teams, pars) {
  if (!pars || !scores) return []
  const byLetter = Object.fromEntries(teams.map((t) => [t.letter, t]))
  return scores
    .filter((s) => byLetter[s.team] && s.strokes && pars[s.hole - 1])
    .map((s) => {
      const moment = describe(s.strokes, pars[s.hole - 1], s.hole)
      return moment && { ...moment, key: `${s.team}-${s.hole}`, team: byLetter[s.team], updated: s.updated }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))
}

export default function LiveHighlights({ scores, teams, pars, now }) {
  const [showAll, setShowAll] = useState(false)
  const highlights = buildHighlights(scores, teams, pars)
  if (!highlights.length) return null
  const shown = showAll ? highlights : highlights.slice(0, SHOWN)
  const hidden = highlights.length - SHOWN

  return (
    <section className="lhl" aria-label="Big moments">
      <ul className="lhl-list">
        {shown.map((h) => (
          <li key={`${h.key}-${h.title}`} className={`lhl-banner ${h.good ? "is-good" : "is-bad"}`}>
            <span className="lhl-icon" aria-hidden="true">{h.icon}</span>
            <span className="lhl-body">
              <b>{h.title}</b>
              <span>
                {h.team.label} ({firstNames(h.team.players)}) {h.text}
              </span>
            </span>
            <small className="lhl-time">{timeAgo(h.updated, now)}</small>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className="lhl-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </section>
  )
}
