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
 *   Match Entry  - finished cards fill in each player's Team Score,
 *                  Contributions and Placement (formula cells are left alone)
 *
 * Scores can only be saved or submitted on the event's date (from the
 * Events tab), so past rounds can't be changed from the website. The
 * "practice" event is always open for trying the cards out; it's never
 * written to Hole by Hole and can be cleared from the website.
 *
 * After changing this file: Deploy > Manage deployments > edit (pencil) >
 * Version: New version > Deploy. That keeps the same web app URL.
 */

const PARS_SHEET = "Course Pars"
const LIVE_SHEET = "Live Scores"
const HOLE_SHEET = "Hole by Hole"
const EVENTS_SHEET_ID = 898289286 // the Events tab (gid in its URL)
const MATCH_SHEET_ID = 1996241982 // the Match Entry tab
const PRACTICE_ID = "practice"

const LIVE_HEADERS = [
  "Event ID", "Team", "Players", "Hole", "Strokes", "Par", "To Par",
  "Player 1", "Player 1 Contributions", "Player 2", "Player 2 Contributions", "Updated",
]

// Pars per hole. City Park and J.S. Clark are 9-hole courses played twice.
const KNOWN_PARS = {
  "Santa Maria": [4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 4, 4, 4, 5, 4, 3, 5],
  "The Island": [4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 4, 5],
  "City Park": [3, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 3, 4, 4, 3, 3],
  "J.S. Clark": [4, 5, 4, 3, 3, 4, 4, 4, 5, 4, 5, 4, 3, 3, 4, 4, 4, 5],
  "Copper Mill": [5, 3, 4, 5, 4, 3, 4, 3, 5, 4, 3, 5, 3, 5, 3, 4, 4, 5],
  "Oak Knoll": [4, 4, 4, 3, 5, 3, 5, 3, 5, 4, 4, 4, 3, 4, 4, 4, 4, 5],
  "Beaver Creek": [4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 4, 5, 4, 3, 4, 3, 4],
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
    if (body.action === "submitAll") return json(submitAll(body))
    if (body.action === "clearPractice") return json(clearPractice())
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
    editable: isGameDay(eventId),
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

// ---- Game-day lock ----

function sameDay(a, b) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone()
  return Utilities.formatDate(a, tz, "yyyy-MM-dd") === Utilities.formatDate(b, tz, "yyyy-MM-dd")
}

// The event's date from the Events tab, or null if it can't be found.
function eventDate(eventId) {
  const sheet = SpreadsheetApp.getActive().getSheets().find((s) => s.getSheetId() === EVENTS_SHEET_ID)
  if (!sheet) return null
  const values = sheet.getDataRange().getValues()
  const header = values[0].map(clean)
  const idCol = header.indexOf("Event ID")
  const dateCol = header.indexOf("Date")
  if (idCol < 0 || dateCol < 0) return null
  const row = values.slice(1).find((r) => clean(r[idCol]) === clean(eventId))
  if (!row) return null
  const value = row[dateCol]
  if (value instanceof Date) return value
  // Text like "10/25/26".
  const parts = clean(value).split("/").map(Number)
  if (parts.length !== 3) return null
  const year = parts[2] < 100 ? 2000 + parts[2] : parts[2]
  return new Date(year, parts[0] - 1, parts[1], 12)
}

function isGameDay(eventId) {
  if (clean(eventId) === PRACTICE_ID) return true
  const date = eventDate(eventId)
  return Boolean(date) && sameDay(date, new Date())
}

const LOCKED_MESSAGE = "This round is locked - scores can only be entered on the day of the event."

// ---- Writes ----

function saveHole(body) {
  const eventId = clean(body.event)
  const team = clean(body.team)
  const hole = Number(body.hole)
  if (!eventId || !team || !(hole >= 1 && hole <= 18)) {
    return { ok: false, error: "Missing event, team or hole" }
  }
  if (!isGameDay(eventId)) return { ok: false, locked: true, error: LOCKED_MESSAGE }

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

// ---- Submitting cards ----
//
// A finished card goes to two places:
//   Hole by Hole - score to par per hole (one row per team, replaced on resubmit)
//   Match Entry  - each player's Team Score and Contributions on that event's
//                  existing rows, plus Placement for every team with a score.
// Match Entry cells that hold a formula are never overwritten, and no rows
// are added there - the event's player rows must already exist.

function sheetById(id) {
  return SpreadsheetApp.getActive().getSheets().find((s) => s.getSheetId() === id) || null
}

// Everything Live Scores holds for one team: strokes and contributions per
// hole, and the two players' names.
function liveCard(eventId, team) {
  const card = { strokes: {}, contributions: [0, 0], players: [] }
  liveRows().values.slice(1).forEach((r) => {
    if (clean(r[0]) !== eventId || clean(r[1]) !== team) return
    card.strokes[Number(r[3])] = Number(r[4])
    card.contributions[0] += Number(r[8]) || 0
    card.contributions[1] += Number(r[10]) || 0
    if (clean(r[7])) card.players = [clean(r[7]), clean(r[9])].filter(Boolean)
  })
  return card
}

function teamsWithScores(eventId) {
  const teams = []
  liveRows().values.slice(1).forEach((r) => {
    const team = clean(r[1])
    if (clean(r[0]) === eventId && team && teams.indexOf(team) < 0) teams.push(team)
  })
  return teams.sort()
}

// Builds what would be written for one team, or { error } if the card
// isn't finished.
function planTeam(eventId, team, pars) {
  const card = liveCard(eventId, team)
  const toPar = []
  for (let h = 1; h <= 18; h++) {
    if (!card.strokes[h]) {
      return { team: team, error: "Hole " + h + " has no score yet.", holes: Object.keys(card.strokes).length }
    }
    toPar.push(card.strokes[h] - pars[h - 1])
  }
  return {
    team: team,
    players: card.players,
    toPar: toPar,
    teamScore: toPar.reduce((a, b) => a + b, 0),
    contributions: card.contributions,
  }
}

function writeHoleByHole(eventName, plan) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HOLE_SHEET)
  if (!sheet) throw new Error("The Hole by Hole tab is missing.")
  const row = [eventName, plan.team, plan.players.join(" / ")].concat(plan.toPar)
  const values = sheet.getDataRange().getValues()
  for (let i = 1; i < values.length; i++) {
    if (clean(values[i][0]).toLowerCase() === eventName.toLowerCase() && clean(values[i][1]) === plan.team) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
      return
    }
  }
  sheet.appendRow(row)
}

function matchEntryTable() {
  const sheet = sheetById(MATCH_SHEET_ID)
  if (!sheet) throw new Error("The Match Entry tab is missing.")
  const range = sheet.getDataRange()
  const values = range.getValues()
  const header = values[0].map(clean)
  const cols = {
    event: header.indexOf("Event ID"),
    player: header.indexOf("Player"),
    team: header.indexOf("Team"),
    score: header.indexOf("Team Score"),
    contributions: header.indexOf("Contributions"),
    placement: header.indexOf("Placement"),
  }
  if (cols.event < 0 || cols.player < 0 || cols.score < 0 || cols.contributions < 0) {
    throw new Error("Match Entry is missing an Event ID, Player, Team Score or Contributions column.")
  }
  return { sheet: sheet, values: values, formulas: range.getFormulas(), cols: cols }
}

// Cell changes for one team's players: [{ row, col, value, label }].
// Cells with formulas are skipped.
function matchEntryChanges(table, matchEventId, plan) {
  const changes = []
  const missing = []
  plan.players.forEach((name, i) => {
    const r = table.values.findIndex((row, idx) =>
      idx > 0 && clean(row[table.cols.event]) === matchEventId && clean(row[table.cols.player]) === name)
    if (r < 0) {
      missing.push(name)
      return
    }
    const set = (col, value, label) => {
      if (col < 0 || table.formulas[r][col]) return
      changes.push({ row: r, col: col, value: value, label: name + " " + label + " = " + value })
    }
    set(table.cols.score, plan.teamScore, "Team Score")
    set(table.cols.contributions, plan.contributions[i], "Contributions")
  })
  return { changes: changes, missing: missing }
}

// Placement for every team in the event that has a Team Score, ranked by
// score with ties sharing a place (1, 2, 2, 4...).
function placementChanges(table, matchEventId, newScores) {
  const c = table.cols
  if (c.placement < 0) return []
  const scoreByTeam = {}
  table.values.forEach((row, idx) => {
    if (idx === 0 || clean(row[c.event]) !== matchEventId) return
    const team = c.team >= 0 ? clean(row[c.team]) : ""
    const score = row[c.score]
    if (team && score !== "" && !isNaN(Number(score))) scoreByTeam[team] = Number(score)
  })
  Object.keys(newScores).forEach((team) => { scoreByTeam[team] = newScores[team] })

  const scores = Object.keys(scoreByTeam).map((t) => scoreByTeam[t])
  const changes = []
  table.values.forEach((row, idx) => {
    if (idx === 0 || clean(row[c.event]) !== matchEventId) return
    const team = c.team >= 0 ? clean(row[c.team]) : ""
    if (!(team in scoreByTeam) || table.formulas[idx][c.placement]) return
    const place = 1 + scores.filter((s) => s < scoreByTeam[team]).length
    changes.push({ row: idx, col: c.placement, value: place, label: clean(row[c.player]) + " Placement = " + place })
  })
  return changes
}

function applyChanges(table, changes) {
  changes.forEach((ch) => table.sheet.getRange(ch.row + 1, ch.col + 1).setValue(ch.value))
}

// Submits the given teams (or every team with scores). With dryRun, nothing
// is written - it returns what would be written. `matchEvent` lets a dry run
// of the practice round be checked against a real event's Match Entry rows.
function submitTeams(body, onlyTeam) {
  const eventId = clean(body.event)
  const eventName = clean(body.eventName)
  const dryRun = Boolean(body.dryRun)
  const matchEventId = clean(body.matchEvent || eventId)

  if (!dryRun) {
    if (eventId === PRACTICE_ID) return { ok: false, error: "Practice cards can't be submitted - this was only a test." }
    if (!isGameDay(eventId)) return { ok: false, locked: true, error: LOCKED_MESSAGE }
  }
  const pars = getPars(body.course)
  if (!pars) return { ok: false, error: "Pars for this course aren't filled in on the Course Pars tab." }

  const teams = onlyTeam ? [onlyTeam] : teamsWithScores(eventId)
  const plans = teams.map((team) => planTeam(eventId, team, pars))
  const finished = plans.filter((p) => !p.error)
  const unfinished = plans.filter((p) => p.error).map((p) => ({ team: p.team, holes: p.holes, error: p.error }))
  if (onlyTeam && unfinished.length) return { ok: false, error: unfinished[0].error }

  const table = matchEntryTable()
  let changes = []
  const missing = []
  const newScores = {}
  finished.forEach((plan) => {
    const result = matchEntryChanges(table, matchEventId, plan)
    changes = changes.concat(result.changes)
    result.missing.forEach((name) => missing.push(name))
    newScores[plan.team] = plan.teamScore
  })
  changes = changes.concat(placementChanges(table, matchEventId, newScores))

  if (!dryRun) {
    finished.forEach((plan) => writeHoleByHole(eventName, plan))
    applyChanges(table, changes)
  }

  return {
    ok: true,
    dryRun: dryRun,
    submitted: finished.map((p) => p.team),
    unfinished: unfinished,
    missingPlayers: missing,
    matchEntry: changes.map((ch) => ch.label),
  }
}

function submitCard(body) {
  const team = clean(body.team)
  if (!team) return { ok: false, error: "Missing team" }
  return submitTeams(body, team)
}

function submitAll(body) {
  return submitTeams(body, null)
}

// Deletes every practice-round row from Live Scores.
function clearPractice() {
  const live = liveRows()
  for (let i = live.values.length - 1; i >= 1; i--) {
    if (clean(live.values[i][0]) === PRACTICE_ID) live.sheet.deleteRow(i + 1)
  }
  return { ok: true }
}
