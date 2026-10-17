// Live scoring talks to a Google Apps Script web app attached to the tour's
// Google Sheet (scripts/live-scoring.gs). Reads are plain GETs; writes are
// POSTed as text/plain so the browser doesn't need a CORS preflight.
//
// Saves made with no signal (common on a course) are queued in
// localStorage and re-sent automatically.

import { LIVE_SCORING_URL } from "../siteConfig"

const QUEUE_KEY = "ht-live-queue"
const MOCK_KEY = "ht-live-mock"

// While developing locally without a deployed script, scores are kept in
// this browser only so the pages can still be tried out.
const useMock = !LIVE_SCORING_URL && import.meta.env.DEV

export const liveScoringReady = Boolean(LIVE_SCORING_URL) || useMock

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
}

function mockRequest(payload) {
  const db = readStore(MOCK_KEY, { scores: [], submitted: {} })
  if (payload.action === "state") {
    return {
      ok: true,
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
  writeStore(MOCK_KEY, db)
  return { ok: true }
}

// ---- Requests ----

export async function getLiveState({ eventId, course, eventName }) {
  if (useMock) return mockRequest({ action: "state", event: eventId, course, eventName })

  const params = new URLSearchParams({ action: "state", event: eventId, course, eventName, t: Date.now() })
  const response = await fetch(`${LIVE_SCORING_URL}?${params}`)
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't load live scores")
  return data
}

async function post(payload) {
  if (useMock) return mockRequest(payload)

  const response = await fetch(LIVE_SCORING_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || "Couldn't save")
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

export function flushQueue() {
  if (flushing) return flushing

  flushing = (async () => {
    let queue = readStore(QUEUE_KEY, [])
    while (queue.length > 0) {
      const { id, ...item } = queue[0]
      try {
        await post(item)
      } catch {
        break
      }
      // Re-read in case a newer save was queued while this one was sending.
      queue = readStore(QUEUE_KEY, []).filter((q) => q.id !== id)
      writeStore(QUEUE_KEY, queue)
    }
    flushing = null
    return queue.length
  })()

  return flushing
}

export function pendingSaves(eventId, team) {
  return readStore(QUEUE_KEY, []).filter((q) => q.event === eventId && q.team === team)
}

export function submitCard(payload) {
  return post({ action: "submit", ...payload })
}
