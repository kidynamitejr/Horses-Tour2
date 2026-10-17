import { useCallback, useEffect, useState } from "react"
import { getEvents, getMatchEntry, getPlayers } from "../data/googleSheets"
import { getLiveState, pendingSaves } from "../data/liveScoring"

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

// Score per hole (index 0-17) for one team, with unsent saves from this
// phone laid over what the server has.
export function teamCard(state, eventId, letter) {
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
  return { strokes, contributions }
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

export function useLiveEvent(eventIdParam) {
  const [events, setEvents] = useState([])
  const [matchEntry, setMatchEntry] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [state, setState] = useState(null)
  const [error, setError] = useState("")
  const [loadedAt, setLoadedAt] = useState(null)

  useEffect(() => {
    getEvents().then(setEvents)
    getMatchEntry().then(setMatchEntry)
    getPlayers().then((rows) => {
      const ids = {}
      rows.forEach((p) => { ids[p.Name] = p["Player ID"] })
      setPlayerIds(ids)
    })
  }, [])

  const event = eventIdParam
    ? events.find((e) => e["Event ID"] === eventIdParam) || null
    : pickDefaultEvent(events)

  const eventId = event?.["Event ID"] || ""
  const course = (event?.Course || "").trim()
  const eventName = (event?.["Event Name"] || "").trim()
  const date = (event?.Date || "").trim()

  const refresh = useCallback(() => {
    if (!eventId) return Promise.resolve()
    return getLiveState({ eventId, course, eventName, date })
      .then((data) => {
        setState(data)
        setError("")
        setLoadedAt(new Date())
      })
      .catch(() => setError("Couldn't reach live scoring - check your signal."))
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
    teams: eventId ? buildTeams(matchEntry, eventId) : [],
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
