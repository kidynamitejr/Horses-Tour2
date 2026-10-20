import { useEffect, useState } from "react"
import { getEvents, getMatchEntry, getPlayers } from "../data/googleSheets"
import { liveScoringReady, setTeams } from "../data/liveScoring"
import { getPlayerSummaries } from "../utils/matchEntry"
import { parseEventDate } from "../utils/liveEvent"

// Auto Matchmaking: every active player ranked by ranking points from the
// last match (or their average if they missed it), a Playing dropdown for
// each, and the resulting pairings - 1st with last, 2nd with second to
// last, and so on. With an odd number playing, a sub fills in for one of
// the missing players at that player's spot.

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function num(value) {
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked - choices just won't be remembered.
  }
}

function AutoMatchmakingPage() {
  const [players, setPlayers] = useState([])
  const [matchEntry, setMatchEntry] = useState([])
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState({})
  const [subFor, setSubFor] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    getPlayers().then(setPlayers)
    getMatchEntry().then(setMatchEntry)
    getEvents().then(setEvents)
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dated = events
    .map((e) => ({ e, date: parseEventDate(e.Date) }))
    .filter((x) => x.date)
    .sort((a, b) => a.date - b.date)

  const nextEvent = dated.find((x) => x.date >= today)?.e || null
  const nextId = nextEvent?.["Event ID"] || ""

  // The last match = the most recent event that has scores in Match Entry.
  const scoredIds = new Set(matchEntry.filter((r) => num(r["Team Score"]) != null).map((r) => r["Event ID"]))
  const lastEvent = [...dated].reverse().find((x) => x.date < today && scoredIds.has(x.e["Event ID"]))?.e || null
  const lastId = lastEvent?.["Event ID"] || ""

  const storeKey = `ht-matchmaking-${nextId}`
  const statusFor = (name) => status[name] || readStore(storeKey)[name] || "playing"

  const summaries = getPlayerSummaries(matchEntry)

  const ranked = players
    .filter((p) => /^active$/i.test((p.Active || "").trim()) && p.Name && !/\(sub\)/i.test(p.Name))
    .map((p) => {
      const name = p.Name.trim()
      const lastRow = matchEntry.find(
        (r) => r["Event ID"] === lastId && (r.Player || "").trim() === name && num(r["Team Score"]) != null,
      )
      const lastPoints = lastRow ? num(lastRow["Match Ranking Points"]) : null
      const average = summaries[name]?.avgRankingPoints ?? 0
      return {
        name,
        seed: lastPoints ?? average,
        source: lastPoints != null ? "Last match" : "Average",
        average,
      }
    })
    .sort((a, b) => b.seed - a.seed || b.average - a.average || a.name.localeCompare(b.name))

  const playing = ranked.filter((p) => statusFor(p.name) === "playing")
  const missing = ranked.filter((p) => statusFor(p.name) !== "playing")

  // Sub name the way the sheet does it: "Bub (Sub)", or the full name when
  // a first name is shared ("Cole Browning (Sub)"). Prefer a name that
  // already has a Match Entry row for the next event.
  function subName(name) {
    const first = name.split(" ")[0]
    const options = [`${first} (Sub)`, `${name} (Sub)`]
    const existing = options.find((n) =>
      matchEntry.some((r) => r["Event ID"] === nextId && (r.Player || "").trim() === n))
    if (existing) return existing
    const shared = ranked.filter((p) => p.name.split(" ")[0] === first).length > 1
    return shared ? `${name} (Sub)` : `${first} (Sub)`
  }

  // Odd number playing: a sub takes one missing player's spot. Default to
  // the missing player ranked closest to the middle of the field.
  const needsSub = playing.length % 2 === 1
  let subTarget = null
  if (needsSub && missing.length) {
    subTarget = missing.find((m) => m.name === subFor) || null
    if (!subTarget) {
      const middle = playing[Math.floor(playing.length / 2)]?.seed ?? 0
      subTarget = [...missing].sort((a, b) => Math.abs(a.seed - middle) - Math.abs(b.seed - middle))[0]
    }
  }

  const field = playing.map((p) => ({ ...p, isSub: false }))
  if (subTarget) {
    field.push({ name: subName(subTarget.name), seed: subTarget.seed, source: `${subTarget.name}'s spot`, isSub: true })
    field.sort((a, b) => b.seed - a.seed)
  }

  const teams = []
  for (let i = 0; i < Math.floor(field.length / 2); i++) {
    teams.push({ letter: LETTERS[i], players: [field[i], field[field.length - 1 - i]] })
  }
  const leftOver = field.length % 2 === 1 ? field[Math.floor(field.length / 2)] : null

  function setPlayerStatus(name, value) {
    const next = { ...readStore(storeKey), ...status, [name]: value }
    setStatus(next)
    writeStore(storeKey, next)
    setMessage("")
  }

  async function save() {
    if (!window.confirm(`Write these ${teams.length} teams into Match Entry column C for ${nextEvent["Event Name"].trim()}?`)) return
    setSaving(true)
    setMessage("")
    try {
      const assignments = teams.flatMap((t) => t.players.map((p) => ({ player: p.name, team: t.letter })))
      const result = await setTeams({ event: nextId, assignments })
      setMessage(result.missing?.length
        ? `Saved. Not found in Match Entry for this event: ${result.missing.join(", ")} - add a row for them and save again.`
        : "Teams saved to Match Entry.")
    } catch (err) {
      setMessage(err.message || "Couldn't save the teams.")
    } finally {
      setSaving(false)
    }
  }

  const loading = players.length === 0 || events.length === 0

  return (
    <div className="mm-page">

      <section className="mm-head">
        <span className="mm-eyebrow">Next event</span>
        <h2>{nextEvent ? nextEvent["Event Name"] : loading ? "Loading..." : "No upcoming event"}</h2>
        {nextEvent && (
          <p>
            {nextEvent.Date} · {nextEvent.Course}
            {lastEvent && <> · Seeded from <b>{lastEvent["Event Name"].trim()}</b> (last match)</>}
          </p>
        )}
      </section>

      <div className="mm-grid">
        <section className="mm-card">
          <div className="mm-card-head">
            <h3>Players</h3>
            <span>{playing.length} playing · {missing.length} out</span>
          </div>
          <table className="mm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Ranking Pts</th>
                <th>Playing?</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => {
                const value = statusFor(p.name)
                return (
                  <tr key={p.name} className={value === "playing" ? "" : "is-out"}>
                    <td className="mm-rank">{i + 1}</td>
                    <td className="mm-name">{p.name}</td>
                    <td className="mm-points">
                      <b>{p.seed.toFixed(2)}</b>
                      <small>{p.source}</small>
                    </td>
                    <td>
                      <select
                        value={value}
                        onChange={(e) => setPlayerStatus(p.name, e.target.value)}
                        aria-label={`Is ${p.name} playing?`}
                      >
                        <option value="playing">Playing</option>
                        <option value="out">Not playing</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="mm-card">
          <div className="mm-card-head">
            <h3>Pairings</h3>
            <span>{teams.length} teams · 1st with last, 2nd with second to last</span>
          </div>

          {needsSub && missing.length > 0 && (
            <label className="mm-sub">
              <span>Odd number playing - the sub fills in for:</span>
              <select value={subTarget?.name || ""} onChange={(e) => setSubFor(e.target.value)}>
                {missing.map((m) => (
                  <option key={m.name} value={m.name}>{m.name} ({m.seed.toFixed(2)})</option>
                ))}
              </select>
            </label>
          )}
          {leftOver && (
            <p className="mm-warn">
              Odd number playing and nobody is marked out, so {leftOver.name} has no partner -
              mark someone as not playing to bring in a sub.
            </p>
          )}

          <ol className="mm-teams">
            {teams.map((t) => (
              <li key={t.letter}>
                <span className="mm-letter">Team {t.letter}</span>
                {t.players.map((p) => (
                  <span key={p.name} className={`mm-player${p.isSub ? " is-sub" : ""}`}>
                    <b>{p.name}</b>
                    <small>{p.seed.toFixed(2)}{p.isSub ? ` · ${p.source}` : ""}</small>
                  </span>
                ))}
              </li>
            ))}
          </ol>

          {liveScoringReady && nextEvent && teams.length > 0 && (
            <div className="mm-save">
              <button type="button" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save teams to Match Entry"}
              </button>
              <small>Fills column C (Team) on {nextEvent["Event Name"].trim()}&apos;s rows. Players not playing are cleared.</small>
              {message && <p>{message}</p>}
            </div>
          )}
        </section>
      </div>

    </div>
  )
}

export default AutoMatchmakingPage
