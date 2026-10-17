import { useCallback, useEffect, useMemo, useState } from "react"
import { getEvents, getHoleByHole, getMatchEntry, getPlayers } from "../data/googleSheets"
import { PRACTICE_ID, getLiveState, pendingSaves, readCachedState } from "../data/liveScoring"

// "M/D/YY" from the Events tab.
export function parseEventDate(text) {
  const parts = (text || "").split("/").map((p) => p.trim())
  if (parts.length !== 3) return null
  const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2])
  const date = new Date(year, Number(parts[0]) - 1, Number(parts[1]))
  return isNaN(date) ? null : date
}

// Today's event if there is one, otherwise the next one, otherwise the
// most recent.
export function pickDefaultEvent(events) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dated = events
    .map((e) => ({ e, date: parseEventDate(e.Date) }))
    .filter((x) => x.date)
    .sort((a, b) => a.date - b.date)
  const upcoming = dated.find((x) => x.date >= today)
  return (upcoming || dated[dated.length - 1])?.e || null
}

export function isToday(event) {
  const date = parseEventDate(event?.Date)
  if (!date) return false
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

export function formatToPar(value) {
  if (value == null || isNaN(value)) return "-"
  if (value === 0) return "E"
  return value > 0 ? `+${value}` : String(value)
}

// Teams for an event come from the Match Entry tab (one row per player
// with a team letter), shown as Team 1, Team 2... in letter order.
function buildTeams(matchEntry, eventId) {
  const byLetter = {}
  matchEntry.forEach((row) => {
    if (row["Event ID"] !== eventId || !row.Player || !row.Team) return
    const letter = row.Team.trim()
    if (!byLetter[letter]) byLetter[letter] = []
    byLetter[letter].push(row.Player.trim())
  })
  return Object.keys(byLetter).sort().map((letter, index) => ({
    letter,
    label: `Team ${index + 1}`,
    players: byLetter[letter],
  }))
}

// One team's card: score per hole (index 0-17), contributions per hole
// and contribution totals. Live entries (plus unsent saves from this
// phone) come first; a past event with no live entries is filled in from
// the Hole by Hole tab (score to par) and Match Entry (contribution
// totals - Hole by Hole has no per-hole contributions).
export function teamCard(live, team) {
  const { state, eventId, pars, practice, eventName, baseId, holeRows = [], matchEntry = [] } = live
  const letter = team.letter
  const strokes = Array(18).fill(null)
  const contributions = Array.from({ length: 18 }, () => [0, 0])
  ;(state?.scores || []).forEach((s) => {
    if (s.team !== letter || !(s.hole >= 1 && s.hole <= 18)) return
    strokes[s.hole - 1] = s.strokes
    contributions[s.hole - 1] = s.contributions || [0, 0]
  })
  pendingSaves(eventId, letter).forEach((q) => {
    strokes[q.hole - 1] = q.strokes ?? null
    contributions[q.hole - 1] = q.contributions || [0, 0]
  })

  if (strokes.some(Boolean) || practice || !pars) {
    return { strokes, contributions, contributionTotals: null, source: "live" }
  }

  const entries = team.players.map((player) => matchEntry.find(
    (r) => r["Event ID"] === baseId && (r.Player || "").trim() === player && (r.Team || "").trim() === letter
  ))
  const contributionTotals = entries.map((entry) => {
    const value = parseFloat(entry?.Contributions)
    return isNaN(value) ? null : value
  })
  // The official team score (to par) from Match Entry.
  const officialToPar = parseFloat(entries.find((e) => e?.["Team Score"])?.["Team Score"])

  const name = eventName.toLowerCase()
  const row = holeRows.find(
    (r) => (r["Event Name"] || "").trim().toLowerCase() === name && (r["Team letter"] || "").trim() === letter
  )
  if (row) {
    for (let h = 1; h <= 18; h++) {
      const toPar = parseFloat(row[`Hole ${h}`])
      if (!isNaN(toPar)) strokes[h - 1] = pars[h - 1] + toPar
    }
  }

  if (!row && contributionTotals.every((v) => v == null)) {
    return { strokes, contributions, contributionTotals: null, source: "live" }
  }
  return {
    strokes,
    contributions: null,
    contributionTotals,
    officialToPar: isNaN(officialToPar) ? null : officialToPar,
    source: "history",
  }
}

export function summarizeCard(card, pars) {
  let total = 0
  let toPar = 0
  let thru = 0
  card.strokes.forEach((s, i) => {
    if (!s) return
    thru += 1
    total += s
    if (pars) toPar += s - pars[i]
  })
  return { total, toPar: pars && thru ? toPar : thru ? null : 0, thru }
}

// The event a page is showing. The practice round borrows the next
// event's course and teams under its own always-open ID.
function resolveEvent(events, eventIdParam) {
  const practice = eventIdParam === PRACTICE_ID
  const base = eventIdParam && !practice
    ? events.find((e) => e["Event ID"] === eventIdParam) || null
    : pickDefaultEvent(events)
  const eventName = practice ? "Practice Round" : (base?.["Event Name"] || "").trim()
  return {
    event: base && practice ? { ...base, "Event ID": PRACTICE_ID, "Event Name": eventName } : base,
    baseId: base?.["Event ID"] || "",
    practice,
    eventId: base ? (practice ? PRACTICE_ID : base["Event ID"]) : "",
    course: (base?.Course || "").trim(),
    eventName,
    date: (base?.Date || "").trim(),
  }
}

export function useLiveEvent(eventIdParam) {
  const [events, setEvents] = useState([])
  const [matchEntry, setMatchEntry] = useState([])
  const [holeRows, setHoleRows] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [state, setState] = useState(null)
  const [error, setError] = useState("")
  const [loadedAt, setLoadedAt] = useState(null)

  useEffect(() => {
    getEvents().then(setEvents)
    getMatchEntry().then(setMatchEntry)
    getHoleByHole().then(setHoleRows)
    getPlayers().then((rows) => {
      const ids = {}
      rows.forEach((p) => { ids[p.Name] = p["Player ID"] })
      setPlayerIds(ids)
    })
  }, [])

  const resolved = useMemo(() => resolveEvent(events, eventIdParam), [events, eventIdParam])
  const { event, baseId, practice, eventId, course, eventName, date } = resolved

  const refresh = useCallback(() => {
    if (!eventId) return Promise.resolve()
    return getLiveState({ eventId, course, eventName, date })
      .then((data) => {
        setState(data)
        setError("")
        setLoadedAt(new Date())
      })
      .catch(() => {
        // No signal: fall back to the copy saved on this phone.
        const cached = readCachedState(eventId)
        if (cached) setState((current) => current || cached)
        setError(cached
          ? "No signal - showing the scores saved on this phone. New holes will send when you're back in range."
          : "Couldn't reach live scoring - check your signal.")
      })
  }, [eventId, course, eventName, date])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    events,
    event,
    eventId,
    course,
    eventName,
    date,
    editable: Boolean(state?.editable),
    practice,
    baseId,
    holeRows,
    matchEntry,
    teams: baseId ? buildTeams(matchEntry, baseId) : [],
    playerIds,
    state,
    setState,
    pars: state?.pars || null,
    error,
    loadedAt,
    refresh,
    loading: events.length === 0,
  }
}
