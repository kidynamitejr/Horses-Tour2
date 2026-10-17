/**
 * Horses Tour - live scoring backend.
 *
 * Paste this whole file into the Google Sheet's Extensions > Apps Script
 * editor, run `setup` once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Put the web app URL in
 * LIVE_SCORING_URL in src/siteConfig.js.
 *
 * Tabs it uses (created by `setup` if missing):
 *   Course Pars  - Course | Hole 1 .. Hole 18
 *   Live Scores  - one row per team per hole while a round is in progress
 *   Hole by Hole - finished cards are written here as score to par
 */

const PARS_SHEET = "Course Pars"
const LIVE_SHEET = "Live Scores"
const HOLE_SHEET = "Hole by Hole"

const LIVE_HEADERS = [
  "Event ID", "Team", "Players", "Hole", "Strokes", "Par", "To Par",
  "Player 1", "Player 1 Contributions", "Player 2", "Player 2 Contributions", "Updated",
]

// Pars known so far. City Park is a 9-hole course played twice.
const KNOWN_PARS = {
  "Santa Maria": [4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 4, 4, 4, 5, 4, 3, 5],
  "The Island": [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 4, 5],
  "City Park": [3, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 3, 4, 4, 3, 3],
  "J.S. Clark": [],
  "Copper Mill": [],
  "Oak Knoll": [],
  "Beaver Creek": [],
}

function setup() {
  const book = SpreadsheetApp.getActive()

  let pars = book.getSheetByName(PARS_SHEET)
  if (!pars) {
    pars = book.insertSheet(PARS_SHEET)
    const header = ["Course"]
    for (let i = 1; i <= 18; i++) header.push("Hole " + i)
    const rows = Object.keys(KNOWN_PARS).map((name) => {
      const row = [name].concat(KNOWN_PARS[name])
      while (row.length < 19) row.push("")
      return row
    })
    pars.getRange(1, 1, 1, 19).setValues([header]).setFontWeight("bold")
    pars.getRange(2, 1, rows.length, 19).setValues(rows)
    pars.setFrozenRows(1)
  }

  let live = book.getSheetByName(LIVE_SHEET)
  if (!live) {
    live = book.insertSheet(LIVE_SHEET)
    live.getRange(1, 1, 1, LIVE_HEADERS.length).setValues([LIVE_HEADERS]).setFontWeight("bold")
    live.setFrozenRows(1)
  }
}

// ---- Web app entry points ----

function doGet(e) {
  const p = e.parameter || {}
  if (p.action === "state") {
    return json(getState(String(p.event || ""), String(p.course || ""), String(p.eventName || "")))
  }
  return json({ ok: true, message: "Horses Tour live scoring" })
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}")
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    if (body.action === "save") return json(saveHole(body))
    if (body.action === "submit") return json(submitCard(body))
    return json({ ok: false, error: "Unknown action" })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}

// ---- Reads ----

function clean(value) {
  return String(value == null ? "" : value).trim()
}

function getPars(course) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PARS_SHEET)
  if (!sheet) return null
  const wanted = clean(course).toLowerCase()
  const rows = sheet.getDataRange().getValues().slice(1)
  const row = rows.find((r) => clean(r[0]).toLowerCase() === wanted)
  if (!row) return null
  const pars = row.slice(1, 19).map((v) => Number(v) || 0)
  return pars.every((v) => v > 0) ? pars : null
}

function liveRows() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(LIVE_SHEET)
  if (!sheet) throw new Error("Run setup first - the Live Scores tab is missing.")
  return { sheet: sheet, values: sheet.getDataRange().getValues() }
}

function getState(eventId, course, eventName) {
  const values = liveRows().values.slice(1)
  const scores = values
    .filter((r) => clean(r[0]) === eventId)
    .map((r) => ({
      team: clean(r[1]),
      hole: Number(r[3]),
      strokes: Number(r[4]),
      contributions: [Number(r[8]) || 0, Number(r[10]) || 0],
      players: [clean(r[7]), clean(r[9])],
      updated: r[11] ? new Date(r[11]).toISOString() : null,
    }))

  return {
    ok: true,
    pars: getPars(course),
    scores: scores,
    submitted: submittedTeams(eventName),
    serverTime: new Date().toISOString(),
  }
}

function submittedTeams(eventName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HOLE_SHEET)
  if (!sheet || !eventName) return []
  const wanted = clean(eventName).toLowerCase()
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => clean(r[0]).toLowerCase() === wanted)
    .map((r) => clean(r[1]))
}

// ---- Writes ----

function saveHole(body) {
  const eventId = clean(body.event)
  const team = clean(body.team)
  const hole = Number(body.hole)
  if (!eventId || !team || !(hole >= 1 && hole <= 18)) {
    return { ok: false, error: "Missing event, team or hole" }
  }

  const players = body.players || []
  const contributions = body.contributions || []
  const pars = getPars(body.course)
  const par = pars ? pars[hole - 1] : ""
  const strokes = body.strokes == null || body.strokes === "" ? null : Number(body.strokes)

  const live = liveRows()
  let rowIndex = -1
  for (let i = 1; i < live.values.length; i++) {
    const r = live.values[i]
    if (clean(r[0]) === eventId && clean(r[1]) === team && Number(r[3]) === hole) {
      rowIndex = i + 1
      break
    }
  }

  // Clearing a hole removes its row.
  if (strokes == null) {
    if (rowIndex > 0) live.sheet.deleteRow(rowIndex)
    return { ok: true }
  }

  const row = [
    eventId, team, players.join(" / "), hole, strokes, par, par ? strokes - par : "",
    players[0] || "", Number(contributions[0]) || 0,
    players[1] || "", Number(contributions[1]) || 0,
    new Date(),
  ]

  if (rowIndex > 0) {
    live.sheet.getRange(rowIndex, 1, 1, row.length).setValues([row])
  } else {
    live.sheet.appendRow(row)
  }
  return { ok: true }
}

// Writes a finished card into Hole by Hole (score to par per hole),
// replacing that team's row for the event if it was submitted before.
function submitCard(body) {
  const eventId = clean(body.event)
  const team = clean(body.team)
  const eventName = clean(body.eventName)
  const pars = getPars(body.course)
  if (!pars) return { ok: false, error: "Pars for this course aren't filled in on the Course Pars tab." }

  const strokesByHole = {}
  liveRows().values.slice(1).forEach((r) => {
    if (clean(r[0]) === eventId && clean(r[1]) === team) strokesByHole[Number(r[3])] = Number(r[4])
  })

  const toPar = []
  for (let h = 1; h <= 18; h++) {
    if (!strokesByHole[h]) return { ok: false, error: "Hole " + h + " has no score yet." }
    toPar.push(strokesByHole[h] - pars[h - 1])
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(HOLE_SHEET)
  if (!sheet) return { ok: false, error: "The Hole by Hole tab is missing." }

  const row = [eventName, team, (body.players || []).join(" / ")].concat(toPar)
  const values = sheet.getDataRange().getValues()
  for (let i = 1; i < values.length; i++) {
    if (clean(values[i][0]).toLowerCase() === eventName.toLowerCase() && clean(values[i][1]) === team) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
      return { ok: true }
    }
  }
  sheet.appendRow(row)
  return { ok: true }
}
