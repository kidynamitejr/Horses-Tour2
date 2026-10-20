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
 *   Hole by Hole - finished cards fill columns D-U (score to par per hole)
 *   Match Entry  - finished cards fill columns D (Team Score) and
 *                  E (Contributions) on each player's row
 *   Events       - column G (Winner) once every team has a score
 * Formula cells are never overwritten.
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
    if (body.action === "setTeams") return json(setTeams(body))
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
    submittedPairs: submittedPairs(eventName),
    serverTime: new Date().toISOString(),
  }
}

// Teams whose Hole by Hole row for the event has scores: their letters and
// their players (pairKey), since letters can change between tabs.
function submittedRows(eventName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HOLE_SHEET)
  if (!sheet || !eventName) return []
  const wanted = clean(eventName).toLowerCase()
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => clean(r[0]).toLowerCase() === wanted && clean(r[HOLE_FIRST_COL - 1]) !== "")
}

function submittedTeams(eventName) {
  return submittedRows(eventName).map((r) => clean(r[1]))
}

function submittedPairs(eventName) {
  return submittedRows(eventName).map((r) => pairKey(clean(r[2]).split("/")))
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
// A finished card fills in:
//   Hole by Hole - columns D-U (Hole 1-18, score to par) on the team's row
//   Match Entry  - column D (Team Score) and E (Contributions) on each
//                  player's row for the event
//   Events       - column G (Winner), once every team in the event has a
//                  Team Score
// Cells holding a formula are never overwritten, and Match Entry / Events
// rows are never added - they must already exist.

const HOLE_FIRST_COL = 4 // D (1-based)
const MATCH_COLS = { event: 0, player: 1, team: 2, score: 3, contributions: 4 } // A, B, C, D, E
const EVENTS_COLS = { event: 0, winner: 6 } // A, G

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

// What would be written for one team, or { error } if the card isn't finished.
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

function readTable(sheet) {
  const range = sheet.getDataRange()
  return { sheet: sheet, values: range.getValues(), formulas: range.getFormulas() }
}

// Collects a single-cell write unless that cell holds a formula.
function queueCell(changes, table, row, col, value, label) {
  if (table.formulas[row] && table.formulas[row][col]) return
  changes.push({ table: table, row: row, col: col, value: value, label: label })
}

// "Jacob Dale / Kory Nijoka" -> "jacob dale|kory nijoka" (order doesn't matter)
function pairKey(names) {
  return names.map((n) => clean(n).toLowerCase()).filter(Boolean).sort().join("|")
}

// Hole by Hole: the team's row for the event gets columns D-U. The row is
// found by the players in column C (so re-lettered teams still land in the
// right row), then by team letter. With no row for the team, a full row is
// added.
function holeByHoleChanges(holeTable, eventName, plan, appends) {
  const changes = []
  const name = eventName.toLowerCase()
  const players = pairKey(plan.players)
  const isEvent = (row, idx) => idx > 0 && clean(row[0]).toLowerCase() === name
  let r = holeTable.values.findIndex((row, idx) => isEvent(row, idx) && pairKey(clean(row[2]).split("/")) === players)
  if (r < 0) r = holeTable.values.findIndex((row, idx) => isEvent(row, idx) && clean(row[1]) === plan.team)
  if (r < 0) {
    appends.push({ row: [eventName, plan.team, plan.players.join(" / ")].concat(plan.toPar), label: "Hole by Hole: new row for team " + plan.team })
    return changes
  }
  plan.toPar.forEach((value, i) => {
    queueCell(changes, holeTable, r, HOLE_FIRST_COL - 1 + i, value, "Hole by Hole " + plan.team + " hole " + (i + 1) + " = " + value)
  })
  return changes
}

// Match Entry: each player's row for the event gets D (Team Score) and E
// (Contributions).
function matchEntryChanges(matchTable, matchEventId, plan, missing) {
  const changes = []
  plan.players.forEach((name, i) => {
    const r = matchTable.values.findIndex((row, idx) =>
      idx > 0 && clean(row[MATCH_COLS.event]) === matchEventId && clean(row[MATCH_COLS.player]) === name)
    if (r < 0) {
      missing.push(name)
      return
    }
    queueCell(changes, matchTable, r, MATCH_COLS.score, plan.teamScore, name + " Team Score (D) = " + plan.teamScore)
    queueCell(changes, matchTable, r, MATCH_COLS.contributions, plan.contributions[i], name + " Contributions (E) = " + plan.contributions[i])
  })
  return changes
}

// Events: column G gets the winning team ("Name / Name", ties joined with
// " & ") once every team in the event's Match Entry rows has a Team Score.
function winnerChange(eventsTable, matchTable, matchEventId, newScores) {
  const teams = {}
  matchTable.values.forEach((row, idx) => {
    if (idx === 0 || clean(row[MATCH_COLS.event]) !== matchEventId) return
    const team = clean(row[MATCH_COLS.team])
    if (!team) return
    if (!teams[team]) teams[team] = { players: [], score: null }
    teams[team].players.push(clean(row[MATCH_COLS.player]))
    const score = row[MATCH_COLS.score]
    if (score !== "" && !isNaN(Number(score))) teams[team].score = Number(score)
  })
  Object.keys(newScores).forEach((team) => { if (teams[team]) teams[team].score = newScores[team] })

  const letters = Object.keys(teams)
  if (!letters.length) return { pending: "no teams found in Match Entry" }
  const waiting = letters.filter((t) => teams[t].score == null)
  if (waiting.length) return { pending: "waiting on team " + waiting.join(", ") }

  const best = Math.min.apply(null, letters.map((t) => teams[t].score))
  const winner = letters.filter((t) => teams[t].score === best).map((t) => teams[t].players.join(" / ")).join(" & ")

  const r = eventsTable.values.findIndex((row, idx) => idx > 0 && clean(row[EVENTS_COLS.event]) === matchEventId)
  if (r < 0) return { pending: "event " + matchEventId + " not found in Events" }
  const changes = []
  queueCell(changes, eventsTable, r, EVENTS_COLS.winner, winner, "Events Winner (G) = " + winner)
  return { changes: changes, winner: winner }
}

// Submits one team (or every team with scores). With dryRun nothing is
// written - it reports what would be. `matchEvent` lets a dry run of the
// practice round be checked against a real event's rows.
function submitTeams(body, onlyTeam) {
  const eventId = clean(body.event)
  const dryRun = Boolean(body.dryRun)
  const matchEventId = clean(body.matchEvent || eventId)
  const eventName = clean(body.matchEventName || body.eventName)

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

  const holeSheet = SpreadsheetApp.getActive().getSheetByName(HOLE_SHEET)
  const matchSheet = sheetById(MATCH_SHEET_ID)
  const eventsSheet = sheetById(EVENTS_SHEET_ID)
  if (!holeSheet || !matchSheet || !eventsSheet) return { ok: false, error: "Hole by Hole, Match Entry or Events tab is missing." }
  const holeTable = readTable(holeSheet)
  const matchTable = readTable(matchSheet)
  const eventsTable = readTable(eventsSheet)

  let changes = []
  const appends = []
  const missing = []
  const newScores = {}
  finished.forEach((plan) => {
    changes = changes.concat(holeByHoleChanges(holeTable, eventName, plan, appends))
    changes = changes.concat(matchEntryChanges(matchTable, matchEventId, plan, missing))
    newScores[plan.team] = plan.teamScore
  })
  const winner = finished.length ? winnerChange(eventsTable, matchTable, matchEventId, newScores) : { pending: "no finished cards" }
  if (winner.changes) changes = changes.concat(winner.changes)

  if (!dryRun) {
    changes.forEach((ch) => ch.table.sheet.getRange(ch.row + 1, ch.col + 1).setValue(ch.value))
    appends.forEach((a) => holeSheet.appendRow(a.row))
  }

  return {
    ok: true,
    dryRun: dryRun,
    submitted: finished.map((p) => p.team),
    unfinished: unfinished,
    missingPlayers: missing,
    winner: winner.winner || null,
    winnerPending: winner.pending || null,
    writes: changes.map((ch) => ch.label).concat(appends.map((a) => a.label)),
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

// Auto Matchmaking: writes each player's team letter into Match Entry
// column C on the event's existing rows, and clears it for players on the
// event who aren't playing. Upcoming (or today's) events only; formula
// cells are left alone. Reports players with no row for the event.
function setTeams(body) {
  const eventId = clean(body.event)
  const date = eventDate(eventId)
  if (!date) return { ok: false, error: "That event isn't on the Events tab." }
  const today = new Date()
  if (date < today && !sameDay(date, today)) return { ok: false, error: "Teams can only be set for upcoming events." }

  const sheet = sheetById(MATCH_SHEET_ID)
  if (!sheet) return { ok: false, error: "The Match Entry tab is missing." }
  const table = readTable(sheet)

  const wanted = {}
  ;(body.assignments || []).forEach((a) => { wanted[clean(a.player)] = clean(a.team) })
  const found = {}
  table.values.forEach((row, idx) => {
    if (idx === 0 || clean(row[MATCH_COLS.event]) !== eventId) return
    const name = clean(row[MATCH_COLS.player])
    if (!name) return
    if (name in wanted) found[name] = true
    const letter = wanted[name] || ""
    if (clean(row[MATCH_COLS.team]) === letter || table.formulas[idx][MATCH_COLS.team]) return
    sheet.getRange(idx + 1, MATCH_COLS.team + 1).setValue(letter)
  })
  return { ok: true, missing: Object.keys(wanted).filter((name) => !found[name]) }
}

// Deletes every practice-round row from Live Scores.
function clearPractice() {
  const live = liveRows()
  for (let i = live.values.length - 1; i >= 1; i--) {
    if (clean(live.values[i][0]) === PRACTICE_ID) live.sheet.deleteRow(i + 1)
  }
  return { ok: true }
}
