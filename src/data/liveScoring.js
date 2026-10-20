// Live scoring talks to a Google Apps Script web app attached to the tour's
// Google Sheet (scripts/live-scoring.gs). Reads are plain GETs; writes are
// POSTed as text/plain so the browser doesn't need a CORS preflight.
//
// Saves made with no signal (common on a course) are queued in
// localStorage and re-sent automatically.

import { LIVE_SCORING_URL } from "../siteConfig"

const QUEUE_KEY = "ht-live-queue"
const MOCK_KEY = "ht-live-mock"

// Always-open test event - never written to Hole by Hole.
export const PRACTICE_ID = "practice"

export const LOCKED_MESSAGE = "This round is locked - scores can only be entered on the day of the event."

// While developing locally without a deployed script, scores are kept in
// this browser only so the pages can still be tried out.
const useMock = !LIVE_SCORING_URL && import.meta.env.DEV

export const liveScoringReady = Boolean(LIVE_SCORING_URL) || useMock

// Last scores loaded for an event, kept on the phone so the card still
// shows (and can be added to) when there's no signal.
export function readCachedState(eventId) {
  return readStore(`ht-live-state-${eventId}`, null)
}

function cacheState(eventId, data) {
  writeStore(`ht-live-state-${eventId}`, data)
}

// A hole's +/- changes that haven't been saved yet, so backing out of the
// page doesn't lose them.
function draftKey(eventId, team, hole) {
  return `ht-live-draft-${eventId}-${team}-${hole}`
}

export function readDraft(eventId, team, hole) {
  return readStore(draftKey(eventId, team, hole), null)
}

export function writeDraft(eventId, team, hole, draft) {
  writeStore(draftKey(eventId, team, hole), draft)
}

export function clearDraft(eventId, team, hole) {
  try {
    localStorage.removeItem(draftKey(eventId, team, hole))
  } catch {
    // Storage blocked - nothing to clear.
  }
}

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked - nothing more we can do.
  }
}

// ---- Mock backend (dev only) ----

const MOCK_PARS = {
  "santa maria": [4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 4, 4, 4, 5, 4, 3, 5],
  "the island": [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 4, 5],
  "city park": [3, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 3, 4, 4, 3, 3],
  "j.s. clark": [4, 5, 4, 3, 3, 4, 4, 4, 5, 4, 5, 4, 3, 3, 4, 4, 4, 5],
  "copper mill": [5, 3, 4, 5, 4, 3, 4, 3, 5, 4, 3, 5, 3, 5, 3, 4, 4, 5],
  "oak knoll": [4, 4, 4, 3, 5, 3, 5, 3, 5, 4, 4, 4, 3, 4, 4, 4, 4, 5],
  "beaver creek": [4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 4, 5, 4, 3, 4, 3, 4],
}

function mockIsGameDay(date) {
  const parts = (date || "").split("/").map(Number)
  if (parts.length !== 3) return false
  const day = new Date(parts[2] < 100 ? 2000 + parts[2] : parts[2], parts[0] - 1, parts[1])
  return day.toDateString() === new Date().toDateString()
}

function mockRequest(payload) {
  const db = readStore(MOCK_KEY, { scores: [], submitted: {} })
  const open = payload.event === PRACTICE_ID || mockIsGameDay(payload.date)
  if (payload.action === "setTeams" || payload.action === "planTeams") {
    return { ok: true, added: payload.assignments.map((x) => `${x.player} (team ${x.team})`), updated: [], copiedValues: [], copiedFromRow: 1 }
  }
  if (payload.action === "clearPractice") {
    db.scores = db.scores.filter((s) => s.event !== PRACTICE_ID)
    writeStore(MOCK_KEY, db)
    return { ok: true }
  }
  if (payload.action !== "state" && !open) {
    return { ok: false, locked: true, error: LOCKED_MESSAGE }
  }
  if (payload.action === "state") {
    return {
      ok: true,
      editable: open,
      pars: MOCK_PARS[payload.course.trim().toLowerCase()] || Array(18).fill(4),
      scores: db.scores.filter((s) => s.event === payload.event),
      submitted: db.submitted[payload.event] || [],
    }
  }
  if (payload.action === "save") {
    db.scores = db.scores.filter((s) => !(s.event === payload.event && s.team === payload.team && s.hole === payload.hole))
    if (payload.strokes != null) {
      db.scores.push({
        event: payload.event,
        team: payload.team,
        hole: payload.hole,
        strokes: payload.strokes,
        contributions: payload.contributions,
        players: payload.players,
      })
    }
  }
  if (payload.action === "submit") {
    db.submitted[payload.event] = [...new Set([...(db.submitted[payload.event] || []), payload.team])]
  }
  if (payload.action === "submitAll") {
    const teams = [...new Set(db.scores.filter((s) => s.event === payload.event).map((s) => s.team))]
    const done = teams.filter((t) => db.scores.filter((s) => s.event === payload.event && s.team === t).length === 18)
    db.submitted[payload.event] = [...new Set([...(db.submitted[payload.event] || []), ...done])]
    writeStore(MOCK_KEY, db)
    return {
      ok: true,
      submitted: done,
      unfinished: teams.filter((t) => !done.includes(t)).map((t) => ({
        team: t,
        holes: db.scores.filter((s) => s.event === payload.event && s.team === t).length,
      })),
      missingPlayers: [],
      matchEntry: [],
    }
  }
  writeStore(MOCK_KEY, db)
  return { ok: true }
}

// ---- Requests ----

export async function getLiveState({ eventId, course, eventName, date }) {
  if (useMock) return mockRequest({ action: "state", event: eventId, course, eventName, date })

  const params = new URLSearchParams({ action: "state", event: eventId, course, eventName, t: Date.now() })
  const response = await fetchWithTimeout(`${LIVE_SCORING_URL}?${params}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't load live scores")
  cacheState(eventId, data)
  return data
}

// Weak signal can leave a request hanging for minutes, which would hold
// up every retry behind it - give up after 20 seconds instead.
function fetchWithTimeout(url, options = {}, ms = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// A request the server answered with ok: false (e.g. a locked round).
class RejectedError extends Error {}

async function post(payload) {
  if (useMock) {
    const result = mockRequest(payload)
    if (!result.ok) throw new RejectedError(result.error)
    return result
  }

  const response = await fetchWithTimeout(LIVE_SCORING_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!data.ok) throw new RejectedError(data.error || "Couldn't save")
  return data
}

// Queue a hole save, replacing any unsent save for the same hole, then
// try to send everything waiting.
export function saveHole(payload) {
  const queue = readStore(QUEUE_KEY, []).filter(
    (q) => !(q.event === payload.event && q.team === payload.team && q.hole === payload.hole)
  )
  queue.push({ action: "save", id: `${Date.now()}-${Math.random()}`, ...payload })
  writeStore(QUEUE_KEY, queue)
  return flushQueue()
}

let flushing = null
let lastRejection = ""

// Why the server last refused a queued save (shown on the scorecard).
export function takeRejection() {
  const message = lastRejection
  lastRejection = ""
  return message
}

// Sends queued saves one at a time. Only one send runs at once; callers
// share it. (`flushing` is cleared in .finally, which always runs after
// the assignment - clearing it inside the async body could happen before
// the assignment when the queue is empty, leaving it stuck forever.)
export function flushQueue() {
  if (!flushing) {
    flushing = sendQueued().finally(() => {
      flushing = null
    })
  }
  return flushing
}

async function sendQueued() {
  let queue = readStore(QUEUE_KEY, [])
  while (queue.length > 0) {
    const { id, ...item } = queue[0]
    try {
      await post(item)
    } catch (err) {
      // No signal: keep it queued and try later. Refused by the server
      // (round locked): drop it so it doesn't block the queue.
      if (!(err instanceof RejectedError)) break
      lastRejection = err.message
    }
    // Re-read in case a newer save was queued while this one was sending.
    queue = readStore(QUEUE_KEY, []).filter((q) => q.id !== id)
    writeStore(QUEUE_KEY, queue)
  }
  return queue.length
}

export function pendingSaves(eventId, team) {
  return readStore(QUEUE_KEY, []).filter((q) => q.event === eventId && q.team === team)
}

export function submitCard(payload) {
  return post({ action: "submit", ...payload })
}

// Submits every team with all 18 holes entered (for when someone forgets).
export function submitAll(payload) {
  return post({ action: "submitAll", ...payload })
}

// Sets up Match Entry for an upcoming event (team letters, plus new rows
// for players without one). planTeams only reports what would change.
export function setTeams(payload) {
  return post({ action: "setTeams", ...payload })
}

export async function planTeams(payload) {
  try {
    return await post({ action: "planTeams", ...payload })
  } catch (err) {
    if (/unknown action/i.test(err.message)) {
      throw new Error("Update the Google Apps Script (Deploy > Manage deployments > New version) to save teams.", { cause: err })
    }
    throw err
  }
}

// Who's playing in an upcoming event (the sheet's Matchmaking tab).
export async function getAttendance(eventId) {
  if (useMock) return readStore(`ht-mock-attendance-${eventId}`, { statuses: {}, subFor: "", subName: "" })
  const params = new URLSearchParams({ action: "attendance", event: eventId, t: Date.now() })
  const response = await fetchWithTimeout(`${LIVE_SCORING_URL}?${params}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't load who's playing")
  return data.attendance
}

export function saveAttendance(payload) {
  if (useMock) {
    writeStore(`ht-mock-attendance-${payload.event}`, payload)
    return Promise.resolve({ ok: true })
  }
  return post({ action: "saveAttendance", ...payload })
}

// Saves a photo (base64 JPEG) to the tour's Google Drive and the Gallery
// tab. Uploads get longer than other requests on a slow connection.
export async function uploadPhoto(payload) {
  if (useMock) {
    return { ok: true, photo: { id: Date.now(), url: `data:image/jpeg;base64,${payload.data}` } }
  }
  const response = await fetchWithTimeout(LIVE_SCORING_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "uploadPhoto", ...payload }),
  }, 90000)
  const data = await response.json()
  if (!data.ok) throw new RejectedError(data.error || "Couldn't upload the photo")
  return data
}

// Sponsor stats: one anonymous view / click per ad per browser session
// (so refreshing doesn't inflate the numbers). Not counted while
// developing locally.
export function trackAd(kind, ad) {
  if (!LIVE_SCORING_URL || import.meta.env.DEV) return
  const id = String(ad["Advertisement #"] || "").trim()
  if (!id) return
  const key = `ht-ad-${kind}-${id}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
  } catch {
    // Storage blocked - count it anyway.
  }
  const body = JSON.stringify({ action: "adEvent", kind, ad: id, title: (ad["Advertisement Title"] || "").trim() })
  // sendBeacon survives the page opening the sponsor's site.
  if (navigator.sendBeacon && navigator.sendBeacon(LIVE_SCORING_URL, body)) return
  fetch(LIVE_SCORING_URL, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" } })
    .catch(() => {})
}

export async function getAdStats() {
  if (useMock) return []
  const response = await fetchWithTimeout(`${LIVE_SCORING_URL}?action=adStats&t=${Date.now()}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't load sponsor stats")
  if (!Array.isArray(data.rows)) throw new Error("Sponsor stats need the latest Google Apps Script.")
  return data.rows
}

export function clearPractice() {
  return post({ action: "clearPractice" })
}
