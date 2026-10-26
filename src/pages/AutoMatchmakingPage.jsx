import { useEffect, useRef, useState } from "react"
import { getEvents, getMatchEntry, getPlayers } from "../data/googleSheets"
import { getAttendance, liveScoringReady, planTeams, saveAttendance, setTeams } from "../data/liveScoring"
import { completedEventIds } from "../utils/eventStatus"
import { getPlayerSummaries } from "../utils/matchEntry"
import { parseEventDate } from "../utils/liveEvent"
import { getPartnershipHistory, partnershipLabel } from "../utils/partnership"
import { headshotUrl, playerImageFallback } from "../utils/headshot"

// Auto Matchmaking: every active player ranked by ranking points from the
// last match (or their average if they missed it), a Playing dropdown for
// each, and the resulting pairings - 1st with last, 2nd with second to
// last, and so on. With an odd number playing, a sub fills in for one of
// the missing players at that player's spot.
//
// Who's playing is saved to the sheet's Matchmaking tab, so when the
// current event's last card is in, the Apps Script pairs the next event
// the same way and sets up Match Entry automatically.

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
  const [pickedId, setPickedId] = useState("")
  const [attendance, setAttendance] = useState({ eventId: "", statuses: {}, subFor: "", subName: "", extras: [] })
  const [newName, setNewName] = useState("")
  const [newSeed, setNewSeed] = useState("")
  const [sync, setSync] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const saveTimer = useRef(null)

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

  // Upcoming = no Winner yet. The first one is the event about to be
  // played; later ones can be prepared ahead of time.
  const finished = completedEventIds(events)
  const upcoming = dated.filter((x) => x.date >= today && !finished.has(x.e["Event ID"].trim())).map((x) => x.e)
  const nextEvent = upcoming.find((e) => e["Event ID"] === pickedId) || upcoming[0] || null
  const nextId = nextEvent?.["Event ID"] || ""
  const isNextUp = Boolean(nextEvent) && nextEvent === upcoming[0]
  const playedFirst = isNextUp ? null : upcoming[0]

  // The last match = the most recent finished event with scores.
  const scoredIds = new Set(matchEntry.filter((r) => num(r["Team Score"]) != null).map((r) => r["Event ID"]))
  const lastEvent = [...dated].reverse()
    .find((x) => finished.has(x.e["Event ID"].trim()) && scoredIds.has(x.e["Event ID"]))?.e || null
  const lastId = lastEvent?.["Event ID"] || ""

  // Load the saved choices for the event (from the sheet, or this browser
  // when live scoring isn't connected).
  useEffect(() => {
    if (!nextId) return undefined
    let cancelled = false
    const load = liveScoringReady
      ? getAttendance(nextId)
      : Promise.resolve(readStore(`ht-matchmaking-${nextId}`))
    load
      .then((a) => {
        if (!cancelled) {
          setAttendance({
            eventId: nextId,
            statuses: a.statuses || {},
            subFor: a.subFor || "",
            subName: a.subName || "",
            extras: a.extras || [],
          })
        }
      })
      .catch(() => {
        if (!cancelled) setAttendance({ eventId: nextId, statuses: {}, subFor: "", subName: "", extras: [] })
      })
    return () => { cancelled = true }
  }, [nextId])

  const loaded = attendance.eventId === nextId
  const statusFor = (name) => (loaded && attendance.statuses[name]) || "playing"
  const subFor = loaded ? attendance.subFor : ""
  const extras = loaded ? attendance.extras || [] : []

  const summaries = getPlayerSummaries(matchEntry)

  const playerIds = {}
  players.forEach((p) => { playerIds[(p.Name || "").trim()] = p["Player ID"] })

  // Current tour rank by Ranking Factor (shown next to names, as on the home page).
  const tourRankByName = {}
  Object.entries(summaries)
    .filter(([n, s]) => !/\(sub\)/i.test(n) && s.eventsPlayed > 0)
    .sort((a, b) => b[1].avgRankingPoints - a[1].avgRankingPoints)
    .forEach(([n], index) => { tourRankByName[n] = index + 1 })

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
    // Players added just for this event, at the ranking points you gave them.
    .concat(
      extras
        .filter((x) => !players.some((p) => (p.Name || "").trim() === x.name))
        .map((x) => ({ name: x.name, seed: x.seed, source: "Added", average: x.seed, added: true })),
    )
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

  const defaultSubName = subTarget ? subName(subTarget.name) : ""
  const typedSubName = subTarget && attendance.subFor === subTarget.name ? attendance.subName : ""
  const field = playing.map((p) => ({ ...p, isSub: false }))
  if (subTarget) {
    field.push({ name: typedSubName || defaultSubName, seed: subTarget.seed, source: `${subTarget.name}'s spot`, isSub: true })
    field.sort((a, b) => b.seed - a.seed)
  }

  const teams = []
  for (let i = 0; i < Math.floor(field.length / 2); i++) {
    teams.push({ letter: LETTERS[i], players: [field[i], field[field.length - 1 - i]] })
  }
  const leftOver = field.length % 2 === 1 ? field[Math.floor(field.length / 2)] : null

  // Same numbers as the home page groupings: combined Ranking Factor is
  // the average of both players' season Ranking Factor.
  const boardTeams = teams.map((t) => {
    const names = t.players.map((p) => p.name)
    const combined = names.reduce((sum, n) => sum + (summaries[n]?.avgRankingPoints ?? 0), 0) / names.length
    return { ...t, names, combined, history: getPartnershipHistory(matchEntry, names[0], names[1]) }
  })
  const highest = boardTeams.length ? Math.max(...boardTeams.map((t) => t.combined)) : 0
  const lowest = boardTeams.length ? Math.min(...boardTeams.map((t) => t.combined)) : 0
  const hasSpread = boardTeams.length > 1 && highest > lowest

  // Save choices to the sheet a moment after the last change.
  function updateAttendance(changes) {
    const statuses = {}
    ranked.forEach((p) => { statuses[p.name] = statusFor(p.name) })
    const next = {
      ...attendance,
      eventId: nextId,
      statuses: { ...statuses, ...(changes.statuses || {}) },
      ...(changes.sub || {}),
      extras: changes.extras || attendance.extras || [],
    }
    if (changes.extras) {
      // A removed player drops out of the statuses too.
      const keep = new Set(ranked.filter((p) => !p.added).map((p) => p.name).concat(changes.extras.map((x) => x.name)))
      Object.keys(next.statuses).forEach((n) => { if (!keep.has(n)) delete next.statuses[n] })
    }
    setAttendance(next)
    setMessage("")
    setSync("saving")
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const payload = { event: nextId, statuses: next.statuses, subFor: next.subFor, subName: next.subName, extras: next.extras }
      if (!liveScoringReady) {
        writeStore(`ht-matchmaking-${nextId}`, payload)
        setSync("saved")
        return
      }
      saveAttendance(payload).then(() => setSync("saved")).catch(() => setSync("error"))
    }, 700)
  }

  function setPlayerStatus(name, value) {
    updateAttendance({ statuses: { [name]: value } })
  }

  function addPlayer(e) {
    e.preventDefault()
    const name = newName.trim()
    const seed = parseFloat(newSeed)
    if (!name || isNaN(seed)) return
    if (ranked.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setMessage(`${name} is already on the list.`)
      return
    }
    updateAttendance({
      extras: [...extras, { name, seed }],
      statuses: { [name]: "playing" },
    })
    setNewName("")
    setNewSeed("")
  }

  function removePlayer(name) {
    updateAttendance({ extras: extras.filter((x) => x.name !== name) })
  }

  async function save() {
    setSaving(true)
    setMessage("")
    try {
      const assignments = teams.flatMap((t) => t.players.map((p) => ({ player: p.name, team: t.letter })))
      // Check first, then show what will change before writing anything.
      const plan = await planTeams({ event: nextId, assignments })
      const lines = []
      if (plan.added.length) {
        lines.push(`Add ${plan.added.length} rows (copied from row ${plan.copiedFromRow}, formulas included):`)
        lines.push(...plan.added.map((a) => `  • ${a}`))
      }
      if (plan.updated.length) lines.push(`Update ${plan.updated.length} existing rows: ${plan.updated.join(", ")}`)
      if (plan.copiedValues.length) {
        lines.push(`Heads up - these copy as plain values, not formulas: ${plan.copiedValues.join(", ")}`)
      }
      if (!lines.length) {
        setMessage("Match Entry already matches these teams.")
        return
      }
      const summary = `${nextEvent["Event Name"].trim()} - Match Entry changes:\n\n${lines.join("\n")}\n\nSave?`
      if (!window.confirm(summary)) return

      const result = await setTeams({ event: nextId, assignments })
      setMessage(`Saved. ${result.added.length} rows added, ${result.updated.length} updated.`)
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
        <div className="mm-head-row">
          <div>
            <span className="mm-eyebrow">{isNextUp ? "Next event" : "Upcoming event"}</span>
            <h2>{nextEvent ? nextEvent["Event Name"] : loading ? "Loading..." : "No upcoming event"}</h2>
            {nextEvent && (
              <p>
                {nextEvent.Date} · {nextEvent.Course}
                {lastEvent && <> · Seeded from <b>{lastEvent["Event Name"].trim()}</b> (last match)</>}
              </p>
            )}
          </div>
          {upcoming.length > 1 && (
            <label className="mm-picker">
              <span>Pairing for</span>
              <select value={nextId} onChange={(e) => setPickedId(e.target.value)}>
                {upcoming.map((e) => (
                  <option key={e["Event ID"]} value={e["Event ID"]}>{e["Event Name"].trim()}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {playedFirst && (
          <p className="mm-auto">
            These teams are set up automatically the moment every card from <b>{playedFirst["Event Name"].trim()}</b> is
            in - seeded from that round - so everyone sees their matchup right after it. Until then this is a preview.
          </p>
        )}
        {sync && (
          <span className={`mm-sync is-${sync}`}>
            {sync === "saving"
              ? "Saving choices..."
              : sync === "saved"
                ? "✓ Choices saved to the sheet"
                : "Couldn't save choices - check your connection"}
          </span>
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
                    <td className="mm-name">
                      {p.name}
                      {p.added && (
                        <button type="button" className="mm-remove" onClick={() => removePlayer(p.name)} aria-label={`Remove ${p.name}`}>
                          ×
                        </button>
                      )}
                    </td>
                    <td className="mm-points">
                      <b>{p.seed.toFixed(2)}</b>
                      <small className={p.added ? "mm-added" : ""}>{p.source}</small>
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

          <form className="mm-add" onSubmit={addPlayer}>
            <h4>Add a player to {nextEvent ? nextEvent["Event Name"].trim() : "this event"}</h4>
            <p>For someone new joining - give them the ranking points to slot them in at.</p>
            <div className="mm-add-row">
              <input
                type="text"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="New player's name"
              />
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Ranking pts"
                value={newSeed}
                onChange={(e) => setNewSeed(e.target.value)}
                aria-label="New player's ranking points"
              />
              <button type="submit" disabled={!newName.trim() || newSeed === ""}>Add</button>
            </div>
          </form>
        </section>

        <section className="mm-card mm-board">
          <div className="ev-board-head">
            <h3>Pairings</h3>
            <span>{teams.length} teams · 1st with last, 2nd with second to last · Favorite by combined Ranking Factor</span>
          </div>

          {needsSub && missing.length > 0 && (
            <div className="mm-sub">
              <label>
                <span>Odd number playing - the sub fills in for:</span>
                <select
                  value={subTarget?.name || ""}
                  onChange={(e) => updateAttendance({ sub: { subFor: e.target.value, subName: "" } })}
                >
                  {missing.map((m) => (
                    <option key={m.name} value={m.name}>{m.name} ({m.seed.toFixed(2)})</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sub&apos;s name:</span>
                <input
                  type="text"
                  value={typedSubName}
                  placeholder={defaultSubName}
                  onChange={(e) => updateAttendance({ sub: { subFor: subTarget.name, subName: e.target.value } })}
                />
              </label>
            </div>
          )}
          {leftOver && (
            <p className="mm-warn">
              Odd number playing and nobody is marked out, so {leftOver.name} has no partner -
              mark someone as not playing to bring in a sub.
            </p>
          )}

          <div className="ev-table" role="table" aria-label="Pairings">
            <div className="ev-row ev-row-head" role="row">
              <span role="columnheader">Team</span>
              <span role="columnheader">Players</span>
              <span role="columnheader">Ranking Factor</span>
              <span role="columnheader" className="ev-col-together">Together</span>
              <span role="columnheader" aria-label="Status" />
            </div>

            {boardTeams.map((t) => {
              const favored = t.combined === highest && t.combined > 0
              const underdog = hasSpread && t.combined === lowest
              return (
                <div
                  key={t.letter}
                  role="row"
                  className={`ev-row${favored ? " is-favored" : ""}${underdog ? " is-underdog" : ""}`}
                >
                  <span className="ev-team" role="cell">{t.letter}</span>

                  <span className="ev-players" role="cell">
                    {t.players.map((p) => (
                      <span className={`ev-player${p.isSub ? " mm-is-sub" : ""}`} key={p.name}>
                        <img
                          src={headshotUrl(playerIds[p.name])}
                          alt=""
                          onError={playerImageFallback}
                        />
                        <span className="ev-player-name">{p.name}</span>
                        {tourRankByName[p.name] && <span className="ev-player-rank">#{tourRankByName[p.name]}</span>}
                      </span>
                    ))}
                  </span>

                  <span className="ev-rf" role="cell">
                    <b>{t.combined.toFixed(2)}</b>
                    <span className="ev-rf-track">
                      <span style={{ width: `${highest ? (t.combined / highest) * 100 : 0}%` }} />
                    </span>
                  </span>

                  <span className="ev-together ev-col-together" role="cell">{partnershipLabel(t.history)}</span>

                  <span className="ev-status" role="cell">
                    {favored && <span className="ev-tag ev-tag-favored">★ Favored</span>}
                    {underdog && <span className="ev-tag ev-tag-underdog">Underdog</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {liveScoringReady && isNextUp && teams.length > 0 && (
            <div className="mm-save">
              <button type="button" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save teams to Match Entry"}
              </button>
              <small>
                Sets up {nextEvent["Event Name"].trim()} in Match Entry: adds a row for each player (copying the last row&apos;s
                formulas, with Event ID, name and team filled in) or updates their team letter. You&apos;ll see the changes before
                anything is saved.
              </small>
              {message && <p>{message}</p>}
            </div>
          )}
        </section>
      </div>

    </div>
  )
}

export default AutoMatchmakingPage
