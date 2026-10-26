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
 *   Events       - column G (Winner) and F (Status = Played) once every
 *                  team has a score
 *   Gallery      - photos uploaded from the website are saved to the
 *                  "Horses Tour Gallery" Drive folder and added here
 *   Ad Stats     - anonymous view / click counts per ad per month (no
 *                  personal information is collected)
 *   Ad Clicks    - the date and time of each ad click, and which ad
 *   Settings     - site settings from Admin (the announcement banner)
 *   Matchmaking  - who's playing in the next event (from the Auto
 *                  Matchmaking page); when an event's last card is in,
 *                  the next event is paired and set up automatically
 * Formula cells are never overwritten.
 *
 * Photos: uploads (Gallery, News and headshots) are saved into the website's GitHub
 * repo (uploads/ folder) when GITHUB_TOKEN is set in Script Properties -
 * Google Drive links get blocked when a website shows them. Without the
 * token they fall back to Drive. Run rehostDrivePhotos() once to move
 * earlier Drive uploads to GitHub.
 *
 * Admin: the website's Admin page (matchmaking, sponsor stats, news)
 * needs the admin password. It's kept in this project's Script Properties
 * (Project Settings > Script Properties > ADMIN_PASSWORD), never in this
 * file, because the website's code is public.
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
const GALLERY_SHEET_ID = 4188486 // the Gallery tab
const GALLERY_FOLDER = "Horses Tour Gallery" // Drive folder for uploaded photos
const AD_STATS_SHEET = "Ad Stats"
const GITHUB_REPO = "kidynamitejr/Horses-Tour2" // where uploaded photos are stored
const GITHUB_BRANCH = "main"
const AD_CLICKS_SHEET = "Ad Clicks" // one row per click: time + ad (nothing about who)
const NEWS_SHEET_ID = 1649176247 // the News tab
const NEWS_FOLDER = "Horses Tour News" // Drive folder for article photos

// Actions only the Admin page can use (checked against ADMIN_PASSWORD).
const ADMIN_ACTIONS = [
  "adminCheck", "setTeams", "planTeams", "saveAttendance", "previewAutoPairing",
  "adStats", "clearAdStats", "saveNews", "deleteNews", "deletePhoto",
  "adminData", "saveAdminRow", "deleteAdminRow", "allPars", "savePars",
  "uploadAsset", "saveSettings", "adminSaveCard",
]

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

  // Creates the photo folders (and asks for Google Drive permission), and
  // checks the GitHub token (asks for permission to reach GitHub).
  galleryFolder()
  newsFolder()
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")
  if (token) {
    const check = UrlFetchApp.fetch("https://api.github.com/repos/" + GITHUB_REPO, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
      muteHttpExceptions: true,
    })
    if (check.getResponseCode() !== 200) {
      throw new Error("GITHUB_TOKEN doesn't work for " + GITHUB_REPO + " (" + check.getResponseCode() + ") - check the token.")
    }
    Logger.log("GitHub token works - photo uploads will be saved to " + GITHUB_REPO + "/uploads.")
  }

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
  if (p.action === "settings") return json({ ok: true, settings: readSettings() })
  if (p.action === "attendance") return json({ ok: true, attendance: readAttendance(String(p.event || "")) })
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
    if (ADMIN_ACTIONS.indexOf(body.action) >= 0) {
      const denied = checkAdmin(body)
      if (denied) return json(denied)
    }
    if (body.action === "adminCheck") return json({ ok: true })
    if (body.action === "adStats") return json({ ok: true, rows: readAdStats(), clicks: readAdClicks(200) })
    if (body.action === "clearAdStats") return json(clearAdStats(body))
    if (body.action === "saveNews") return json(saveNews(body))
    if (body.action === "deleteNews") return json(deleteNews(body))
    if (body.action === "deletePhoto") return json(deletePhoto(body))
    if (body.action === "adminData") return json(adminData(body))
    if (body.action === "saveAdminRow") return json(saveAdminRow(body))
    if (body.action === "deleteAdminRow") return json(deleteAdminRow(body))
    if (body.action === "allPars") return json({ ok: true, courses: allPars() })
    if (body.action === "savePars") return json(savePars(body))
    if (body.action === "uploadAsset") return json(uploadAsset(body))
    if (body.action === "saveSettings") return json(saveSettings(body))
    if (body.action === "adminSaveCard") return json(adminSaveCard(body))
    if (body.action === "save") return json(saveHole(body))
    if (body.action === "submit") return json(submitCard(body))
    if (body.action === "submitAll") return json(submitAll(body))
    if (body.action === "clearPractice") return json(clearPractice())
    if (body.action === "setTeams") return json(setTeams(body))
    if (body.action === "saveAttendance") return json(saveAttendance(body))
    if (body.action === "uploadPhoto") return json(uploadPhoto(body))
    if (body.action === "adEvent") return json(recordAdEvent(body))
    if (body.action === "previewAutoPairing") {
      const nextId = nextEventAfter(clean(body.completedEvent))
      const values = sheetById(MATCH_SHEET_ID).getDataRange().getValues()
      return json({ ok: true, event: nextId, assignments: nextId ? buildPairings(clean(body.completedEvent), nextId, readAttendance(nextId), values) : [] })
    }
    if (body.action === "planTeams") return json(setTeams(Object.assign({}, body, { dryRun: true })))
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

function saveHole(body, force) {
  const eventId = clean(body.event)
  const team = clean(body.team)
  const hole = Number(body.hole)
  if (!eventId || !team || !(hole >= 1 && hole <= 18)) {
    return { ok: false, error: "Missing event, team or hole" }
  }
  if (!force && !isGameDay(eventId)) return { ok: false, locked: true, error: LOCKED_MESSAGE }

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
const EVENTS_COLS = { event: 0, status: 5, winner: 6 } // A, F, G

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
  queueCell(changes, eventsTable, r, EVENTS_COLS.status, "Played", "Events Status (F) = Played")
  return { changes: changes, winner: winner }
}

// Submits one team (or every team with scores). With dryRun nothing is
// written - it reports what would be. `matchEvent` lets a dry run of the
// practice round be checked against a real event's rows.
function submitTeams(body, onlyTeam, force) {
  const eventId = clean(body.event)
  const dryRun = Boolean(body.dryRun)
  const matchEventId = clean(body.matchEvent || eventId)
  const eventName = clean(body.matchEventName || body.eventName)

  if (!dryRun) {
    if (eventId === PRACTICE_ID) return { ok: false, error: "Practice cards can't be submitted - this was only a test." }
    if (!force && !isGameDay(eventId)) return { ok: false, locked: true, error: LOCKED_MESSAGE }
  }
  const pars = getPars(body.course)
  if (!pars) return { ok: false, error: "Pars for this course aren't filled in on the Course Pars tab." }

  const teams = onlyTeam ? [onlyTeam] : teamsWithScores(eventId)
  const plans = teams.map((team) => planTeam(eventId, team, pars))
  // Fixing an older round: use the contribution totals given by Admin.
  if (onlyTeam && Array.isArray(body.contributionTotals) && plans[0] && !plans[0].error) {
    plans[0].contributions = body.contributionTotals.map((v) => Number(v) || 0)
  }
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

  let nextEvent = null
  if (!dryRun) {
    changes.forEach((ch) => ch.table.sheet.getRange(ch.row + 1, ch.col + 1).setValue(ch.value))
    appends.forEach((a) => holeSheet.appendRow(a.row))
    // Every team is in: pair the next event so people see their matchups now.
    if (winner.winner) nextEvent = autoMatchmake(matchEventId)
  }

  return {
    ok: true,
    dryRun: dryRun,
    submitted: finished.map((p) => p.team),
    unfinished: unfinished,
    missingPlayers: missing,
    winner: winner.winner || null,
    winnerPending: winner.pending || null,
    nextEvent: nextEvent,
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

// Auto Matchmaking: sets up Match Entry for an upcoming event.
//  - Players who already have a row for the event get their team letter
//    in column C; rows of players not playing are cleared (letter only).
//  - Players playing with no row yet (including brand-new sub names) get
//    one: the last filled Match Entry row is copied (A-U, like dragging it
//    down, so its formulas carry on), then A = Event ID, B = player,
//    C = team letter, and D/E are cleared - on these new rows only. No
//    other row's D/E is ever touched.
// Upcoming (or today's) events only; formula cells are never overwritten.
// With dryRun nothing is written - it reports what would be.
const MATCH_ROW_WIDTH = 21 // A-U: the per-player columns (the side tables start further right)

function setTeams(body) {
  const eventId = clean(body.event)
  const dryRun = Boolean(body.dryRun)
  const date = eventDate(eventId)
  if (!date) return { ok: false, error: "That event isn't on the Events tab." }
  const today = new Date()
  if (date < today && !sameDay(date, today)) return { ok: false, error: "Teams can only be set for upcoming events." }

  const sheet = sheetById(MATCH_SHEET_ID)
  if (!sheet) return { ok: false, error: "The Match Entry tab is missing." }
  const table = readTable(sheet)
  const header = table.values[0].map(clean)

  const assignments = (body.assignments || []).map((a) => ({ player: clean(a.player), team: clean(a.team) }))
  const wanted = {}
  assignments.forEach((a) => { wanted[a.player] = a.team })

  // 1. Existing rows for the event.
  const found = {}
  const updates = []
  table.values.forEach((row, idx) => {
    if (idx === 0 || clean(row[MATCH_COLS.event]) !== eventId) return
    const name = clean(row[MATCH_COLS.player])
    if (!name) return
    if (name in wanted) found[name] = true
    const letter = wanted[name] || ""
    if (clean(row[MATCH_COLS.team]) === letter || table.formulas[idx][MATCH_COLS.team]) return
    updates.push({ row: idx, value: letter, label: name + " team " + (letter || "(cleared)") })
  })

  // 2. New rows for players playing who don't have one yet, in team order.
  const toAdd = assignments
    .filter((a) => !found[a.player])
    .sort((a, b) => a.team.localeCompare(b.team))

  let lastRow = -1
  for (let i = table.values.length - 1; i >= 1; i--) {
    if (clean(table.values[i][MATCH_COLS.event]) !== "") { lastRow = i; break }
  }
  if (toAdd.length && lastRow < 1) return { ok: false, error: "Match Entry has no rows to copy formulas from." }

  // Columns of the copied row that hold plain values rather than formulas
  // (besides A-E) - these get copied as-is, so they're reported.
  const copiedValues = []
  if (toAdd.length) {
    for (let c = 5; c < MATCH_ROW_WIDTH; c++) {
      const value = table.values[lastRow][c]
      if (!table.formulas[lastRow][c] && value !== "" && value != null) {
        copiedValues.push((header[c] || "Column " + (c + 1)) + " (" + value + ")")
      }
    }
  }

  if (!dryRun) {
    updates.forEach((u) => sheet.getRange(u.row + 1, MATCH_COLS.team + 1).setValue(u.value))

    if (toAdd.length) {
      const needed = lastRow + 1 + toAdd.length - sheet.getMaxRows()
      if (needed > 0) sheet.insertRowsAfter(sheet.getMaxRows(), needed)
      const template = sheet.getRange(lastRow + 1, 1, 1, MATCH_ROW_WIDTH)
      const idValue = isNaN(Number(eventId)) ? eventId : Number(eventId)
      toAdd.forEach((a, k) => {
        const r = lastRow + 2 + k
        template.copyTo(sheet.getRange(r, 1, 1, MATCH_ROW_WIDTH))
        const set = (col, value) => {
          if (!table.formulas[lastRow][col]) sheet.getRange(r, col + 1).setValue(value)
        }
        set(MATCH_COLS.event, idValue)
        set(MATCH_COLS.player, a.player)
        set(MATCH_COLS.team, a.team)
        set(MATCH_COLS.score, "")
        set(MATCH_COLS.contributions, "")
      })
    }
  }

  return {
    ok: true,
    dryRun: dryRun,
    updated: updates.map((u) => u.label),
    added: toAdd.map((a) => a.player + " (team " + a.team + ")"),
    copiedFromRow: toAdd.length ? lastRow + 1 : null,
    copiedValues: copiedValues,
    missing: [],
  }
}

// ---- Auto Matchmaking: attendance + automatic pairing ----
//
// The Auto Matchmaking page saves who's playing in the next event to the
// "Matchmaking" tab (one row per player, plus one row for the sub). When
// the last card of an event is in (the Winner gets filled), the next
// event is paired automatically from those choices - seeded from the
// round that just finished - and its Match Entry rows are set up, so
// everyone can see their matchup right away.

const MATCHMAKING_SHEET = "Matchmaking"
const PLAYERS_SHEET_ID = 0 // the Players tab
const SUB_ROW = "(sub)"
const MRP_COL = 13 // N: Match Ranking Points
const AVG_COL = 15 // P: AVG Ranking Points
const TEAM_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function matchmakingSheet() {
  const book = SpreadsheetApp.getActive()
  let sheet = book.getSheetByName(MATCHMAKING_SHEET)
  if (!sheet) {
    sheet = book.insertSheet(MATCHMAKING_SHEET)
    sheet.getRange(1, 1, 1, 6).setValues([["Event ID", "Player", "Playing", "Sub For", "Sub Name", "Added Ranking Pts"]]).setFontWeight("bold")
    sheet.setFrozenRows(1)
  }
  if (!clean(sheet.getRange(1, 6).getValue())) sheet.getRange(1, 6).setValue("Added Ranking Pts").setFontWeight("bold")
  return sheet
}

function readAttendance(eventId) {
  const result = { statuses: {}, subFor: "", subName: "", extras: [] }
  const sheet = SpreadsheetApp.getActive().getSheetByName(MATCHMAKING_SHEET)
  if (!sheet) return result
  sheet.getDataRange().getValues().slice(1).forEach((r) => {
    if (clean(r[0]) !== eventId) return
    if (clean(r[1]) === SUB_ROW) {
      result.subFor = clean(r[3])
      result.subName = clean(r[4])
    } else if (clean(r[1])) {
      result.statuses[clean(r[1])] = /^no/i.test(clean(r[2])) ? "out" : "playing"
      // A player added just for this event, with the ranking points to seed them at.
      if (clean(r[5]) !== "" && !isNaN(Number(r[5]))) result.extras.push({ name: clean(r[1]), seed: Number(r[5]) })
    }
  })
  return result
}

// Replaces the event's rows on the Matchmaking tab.
function saveAttendance(body) {
  const eventId = clean(body.event)
  if (!eventId) return { ok: false, error: "Missing event" }
  const sheet = matchmakingSheet()
  const values = sheet.getDataRange().getValues()
  for (let i = values.length - 1; i >= 1; i--) {
    if (clean(values[i][0]) === eventId) sheet.deleteRow(i + 1)
  }
  const extraSeed = {}
  ;(body.extras || []).forEach((x) => { if (clean(x.name)) extraSeed[clean(x.name)] = Number(x.seed) || 0 })
  const names = Object.keys(body.statuses || {})
  Object.keys(extraSeed).forEach((n) => { if (names.indexOf(n) < 0) names.push(n) })
  const rows = names.map((name) => [
    eventId, name, (body.statuses || {})[name] === "out" ? "No" : "Yes", "", "",
    name in extraSeed ? extraSeed[name] : "",
  ])
  rows.push([eventId, SUB_ROW, "", clean(body.subFor), clean(body.subName), ""])
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows)
  return { ok: true }
}

function eventRows() {
  const sheet = sheetById(EVENTS_SHEET_ID)
  if (!sheet) return []
  return sheet.getDataRange().getValues().slice(1)
    .map((r) => ({ id: clean(r[EVENTS_COLS.event]), date: eventDate(clean(r[EVENTS_COLS.event])), winner: clean(r[EVENTS_COLS.winner]) }))
    .filter((e) => e.id && e.date)
}

// The first event after this one (by date) that doesn't have a winner yet.
function nextEventAfter(eventId) {
  const events = eventRows()
  const current = events.find((e) => e.id === eventId)
  if (!current) return null
  const later = events
    .filter((e) => e.date > current.date && !e.winner)
    .sort((a, b) => a.date - b.date)
  return later.length ? later[0].id : null
}

function activeRoster() {
  const sheet = sheetById(PLAYERS_SHEET_ID)
  if (!sheet) return []
  const values = sheet.getDataRange().getValues()
  const header = values[0].map(clean)
  const nameCol = header.indexOf("Name")
  const activeCol = header.indexOf("Active")
  return values.slice(1)
    .filter((r) => clean(r[nameCol]) && /^active$/i.test(clean(r[activeCol])) && !/\(sub\)/i.test(clean(r[nameCol])))
    .map((r) => clean(r[nameCol]))
}

// Same pairing as the Auto Matchmaking page: seed by the last match's
// ranking points (or the player's average if they missed it), 1st with
// last, 2nd with second to last; an odd count brings in a sub at a missing
// player's spot.
function buildPairings(lastEventId, nextEventId, attendance, matchValues) {
  const firstRow = {}
  matchValues.slice(1).forEach((r) => {
    const name = clean(r[MATCH_COLS.player])
    if (name && !firstRow[name]) firstRow[name] = r
  })
  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v))

  const roster = activeRoster()
  const extras = (attendance.extras || []).filter((x) => roster.indexOf(x.name) < 0)
  const ranked = roster.map((name) => {
    const last = matchValues.find((r) =>
      clean(r[MATCH_COLS.event]) === lastEventId && clean(r[MATCH_COLS.player]) === name && num(r[MATCH_COLS.score]) != null)
    const average = num(firstRow[name] ? firstRow[name][AVG_COL] : null) || 0
    const lastPoints = last ? num(last[MRP_COL]) : null
    return { name: name, seed: lastPoints != null ? lastPoints : average, average: average }
  }).concat(extras.map((x) => ({ name: x.name, seed: x.seed, average: x.seed })))
    .sort((a, b) => b.seed - a.seed || b.average - a.average || a.name.localeCompare(b.name))

  const status = (name) => attendance.statuses[name] || "playing"
  const playing = ranked.filter((p) => status(p.name) === "playing")
  const missing = ranked.filter((p) => status(p.name) !== "playing")

  const field = playing.slice()
  if (playing.length % 2 === 1 && missing.length) {
    let target = missing.find((m) => m.name === attendance.subFor)
    if (!target) {
      const middle = playing[Math.floor(playing.length / 2)].seed
      target = missing.slice().sort((a, b) => Math.abs(a.seed - middle) - Math.abs(b.seed - middle))[0]
    }
    field.push({ name: attendance.subFor === target.name && attendance.subName ? attendance.subName : subNameFor(target.name, ranked, nextEventId, matchValues), seed: target.seed })
    field.sort((a, b) => b.seed - a.seed)
  }

  const assignments = []
  for (let i = 0; i < Math.floor(field.length / 2); i++) {
    assignments.push({ player: field[i].name, team: TEAM_LETTERS[i] })
    assignments.push({ player: field[field.length - 1 - i].name, team: TEAM_LETTERS[i] })
  }
  return assignments
}

// "Bub (Sub)", or the full name when the first name is shared - preferring
// a name that already has a Match Entry row for the event.
function subNameFor(name, ranked, eventId, matchValues) {
  const first = name.split(" ")[0]
  const options = [first + " (Sub)", name + " (Sub)"]
  const existing = options.find((n) => matchValues.some((r) => clean(r[MATCH_COLS.event]) === eventId && clean(r[MATCH_COLS.player]) === n))
  if (existing) return existing
  const shared = ranked.filter((p) => p.name.split(" ")[0] === first).length > 1
  return shared ? name + " (Sub)" : first + " (Sub)"
}

// Pairs the event after `completedEventId`, unless it already has teams.
function autoMatchmake(completedEventId) {
  const nextId = nextEventAfter(completedEventId)
  if (!nextId) return { skipped: "no upcoming event" }
  SpreadsheetApp.flush() // let the Match Entry formulas catch up with the new scores
  const matchValues = sheetById(MATCH_SHEET_ID).getDataRange().getValues()
  const hasTeams = matchValues.some((r, i) => i > 0 && clean(r[MATCH_COLS.event]) === nextId && clean(r[MATCH_COLS.team]))
  if (hasTeams) return { skipped: "event " + nextId + " already has teams" }
  const assignments = buildPairings(completedEventId, nextId, readAttendance(nextId), matchValues)
  if (!assignments.length) return { skipped: "nobody marked as playing" }
  const result = setTeams({ event: nextId, assignments: assignments })
  return { event: nextId, teams: assignments.length / 2, result: result }
}

// ---- Photo hosting ----

// Puts a photo (base64 JPEG) somewhere a website can show it and returns
// the link: the GitHub repo's uploads/ folder when GITHUB_TOKEN is set,
// otherwise Google Drive.
// Creates or replaces a file in the website's GitHub repo.
function githubPut(path, base64, message) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")
  if (!token) throw new Error("Add GITHUB_TOKEN in Project Settings > Script Properties first.")
  const api = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + path
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const existing = UrlFetchApp.fetch(api + "?ref=" + GITHUB_BRANCH, { headers: headers, muteHttpExceptions: true })
  const payload = { message: message, content: base64, branch: GITHUB_BRANCH }
  if (existing.getResponseCode() === 200) payload.sha = JSON.parse(existing.getContentText()).sha
  const response = UrlFetchApp.fetch(api, {
    method: "put",
    contentType: "application/json",
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })
  const code = response.getResponseCode()
  if (code === 200 || code === 201) return
  if (code === 401 || code === 403) {
    throw new Error("GitHub refused the photo - check GITHUB_TOKEN (it may have expired or lack Contents write access).")
  }
  throw new Error("GitHub didn't take the photo (" + code + ") - try again in a minute.")
}

function hostImage(base64, kind, title) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")
  if (!token) return saveImage(kind === "news" ? newsFolder() : galleryFolder(), base64, kind)

  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone()
  const folder = { news: "news", gallery: "gallery", winner: "winners", ad: "ads" }[kind] || "gallery"
  const path = "uploads/" + folder + "/" + Utilities.formatDate(new Date(), tz, "yyyy-MM-dd-HHmmss") +
    "-" + Math.floor(Math.random() * 100000) + ".jpg"
  githubPut(path, base64, "Photo upload: " + String(title || folder).slice(0, 60))
  return "https://raw.githubusercontent.com/" + GITHUB_REPO + "/" + GITHUB_BRANCH + "/" + path
}

// One-time: moves photos uploaded to Google Drive earlier into the GitHub
// repo and updates their links on the Gallery and News tabs. Run it from
// the editor after setting GITHUB_TOKEN.
function rehostDrivePhotos() {
  if (!PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")) {
    throw new Error("Add GITHUB_TOKEN in Project Settings > Script Properties first.")
  }
  const driveId = (url) => {
    const m = String(url || "").match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/)
    return m ? m[1] : null
  }
  let moved = 0
  const fix = (sheet, cols) => {
    if (!sheet) return
    const values = sheet.getDataRange().getValues()
    for (let i = 1; i < values.length; i++) {
      cols.forEach((c) => {
        const id = driveId(values[i][c])
        if (!id) return
        const base64 = Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes())
        sheet.getRange(i + 1, c + 1).setValue(hostImage(base64, sheet.getSheetId() === NEWS_SHEET_ID ? "news" : "gallery", "Moved from Drive"))
        moved++
      })
    }
  }
  fix(sheetById(GALLERY_SHEET_ID), [2]) // C: Image
  fix(sheetById(NEWS_SHEET_ID), [3, 6]) // D: Image, G: Image 2
  Logger.log("Moved " + moved + " photo(s) to GitHub.")
  return moved
}

// Deletes a photo's file wherever it's hosted: the repo's uploads/ folder
// (GitHub) or Google Drive. Other links (e.g. imgur) are just left alone.
function deleteHostedImage(url) {
  const text = String(url || "")
  const gh = text.match(new RegExp("raw\\.githubusercontent\\.com/" + GITHUB_REPO + "/" + GITHUB_BRANCH + "/(uploads/[^?#]+)"))
  if (gh) {
    const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")
    if (!token) return
    const api = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + gh[1]
    const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
    const info = UrlFetchApp.fetch(api + "?ref=" + GITHUB_BRANCH, { headers: headers, muteHttpExceptions: true })
    if (info.getResponseCode() !== 200) return
    UrlFetchApp.fetch(api, {
      method: "delete",
      contentType: "application/json",
      headers: headers,
      payload: JSON.stringify({ message: "Photo deleted", sha: JSON.parse(info.getContentText()).sha, branch: GITHUB_BRANCH }),
      muteHttpExceptions: true,
    })
    return
  }
  const drive = text.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/)
  if (drive) {
    try {
      DriveApp.getFileById(drive[1]).setTrashed(true)
    } catch (err) {
      // Already gone - nothing to do.
    }
  }
}

// Admin: removes a photo from the Gallery tab and deletes its file.
function deletePhoto(body) {
  const sheet = sheetById(GALLERY_SHEET_ID)
  if (!sheet) return { ok: false, error: "The Gallery tab is missing." }
  const id = clean(body.id)
  const values = sheet.getDataRange().getValues()
  for (let i = values.length - 1; i >= 1; i--) {
    if (clean(values[i][0]) === id) {
      deleteHostedImage(values[i][2])
      sheet.deleteRow(i + 1)
      return { ok: true }
    }
  }
  return { ok: false, error: "That photo isn't on the Gallery tab anymore." }
}

// ---- Gallery uploads ----

function galleryFolder() {
  const folders = DriveApp.getFoldersByName(GALLERY_FOLDER)
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(GALLERY_FOLDER)
}

// Saves an uploaded photo to Drive (viewable by link) and adds a Gallery
// row: Photo ID, Event ID, Image link, Caption.
function uploadPhoto(body) {
  const data = String(body.data || "")
  if (!data) return { ok: false, error: "No photo was sent." }
  if (data.length > 10 * 1024 * 1024) return { ok: false, error: "That photo is too big." }
  const sheet = sheetById(GALLERY_SHEET_ID)
  if (!sheet) return { ok: false, error: "The Gallery tab is missing." }

  const url = hostImage(data, "gallery", clean(body.caption) || "Horses Tour photo")

  let maxId = 0
  sheet.getDataRange().getValues().slice(1).forEach((r) => {
    const n = Number(r[0])
    if (n > maxId) maxId = n
  })
  const eventId = clean(body.event)
  sheet.appendRow([maxId + 1, isNaN(Number(eventId)) ? eventId : Number(eventId), url, clean(body.caption).slice(0, 80)])
  return { ok: true, photo: { id: maxId + 1, url: url } }
}

// ---- Sponsor stats (anonymous counts only) ----

function adStatsSheet() {
  const book = SpreadsheetApp.getActive()
  let sheet = book.getSheetByName(AD_STATS_SHEET)
  if (!sheet) {
    sheet = book.insertSheet(AD_STATS_SHEET)
    sheet.getRange(1, 1, 1, 6).setValues([["Month", "Ad #", "Ad", "Views", "Clicks", "Last Click"]]).setFontWeight("bold")
    sheet.setFrozenRows(1)
  }
  if (!clean(sheet.getRange(1, 6).getValue())) sheet.getRange(1, 6).setValue("Last Click").setFontWeight("bold")
  sheet.getRange("F:F").setNumberFormat("m/d/yyyy h:mm am/pm")
  return sheet
}

// Adds one view or click to the ad's row for this month. Only the ad and
// the count are stored - nothing about who viewed or clicked.
function recordAdEvent(body) {
  const kind = clean(body.kind)
  if (kind !== "view" && kind !== "click") return { ok: false, error: "Unknown ad event" }
  const adId = clean(body.ad).slice(0, 12)
  if (!adId) return { ok: false, error: "Missing ad" }
  const month = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM")
  if (kind === "click") logAdClick(adId, clean(body.title).slice(0, 60))
  const sheet = adStatsSheet()
  const values = sheet.getDataRange().getValues()
  const col = kind === "view" ? 4 : 5
  const now = new Date()
  const matches = []
  for (let i = 1; i < values.length; i++) {
    if (monthKey(values[i][0]) === month && clean(values[i][1]) === adId) matches.push(i)
  }
  if (matches.length) {
    // Merge any duplicate rows for this month into the first one.
    const first = matches[0]
    let views = 0
    let clicks = 0
    let lastClick = ""
    matches.forEach((i) => {
      views += Number(values[i][3]) || 0
      clicks += Number(values[i][4]) || 0
      if (values[i][5] instanceof Date && (!lastClick || values[i][5] > lastClick)) lastClick = values[i][5]
    })
    if (kind === "view") views++
    else {
      clicks++
      lastClick = now
    }
    sheet.getRange(first + 1, 1, 1, 6).setValues([["'" + month, adId, values[first][2], views, clicks, lastClick]])
    matches.slice(1).reverse().forEach((i) => sheet.deleteRow(i + 1))
    return { ok: true }
  }
  // "'" keeps "2026-10" as text (Sheets would turn it into a date).
  sheet.appendRow(["'" + month, adId, clean(body.title).slice(0, 60), kind === "view" ? 1 : 0, kind === "click" ? 1 : 0, kind === "click" ? now : ""])
  return { ok: true }
}

function adClicksSheet() {
  const book = SpreadsheetApp.getActive()
  let sheet = book.getSheetByName(AD_CLICKS_SHEET)
  if (!sheet) {
    sheet = book.insertSheet(AD_CLICKS_SHEET)
    sheet.getRange(1, 1, 1, 3).setValues([["Clicked At", "Ad #", "Ad"]]).setFontWeight("bold")
    sheet.setFrozenRows(1)
    sheet.getRange("A:A").setNumberFormat("m/d/yyyy h:mm am/pm")
  }
  return sheet
}

function logAdClick(adId, title) {
  adClicksSheet().appendRow([new Date(), adId, title])
}

// The most recent clicks (newest first) for the Sponsor Stats page.
function readAdClicks(limit) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AD_CLICKS_SHEET)
  if (!sheet) return []
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => r[0] instanceof Date && clean(r[1]))
    .map((r) => ({ at: r[0].toISOString(), ad: clean(r[1]) }))
    .reverse()
    .slice(0, limit || 200)
}

// Clears the view / click history - for one ad (body.ad) or all ads.
function clearAdStats(body) {
  const adId = clean(body.ad)
  let removed = 0
  ;[AD_STATS_SHEET, AD_CLICKS_SHEET].forEach((name) => {
    const sheet = SpreadsheetApp.getActive().getSheetByName(name)
    if (!sheet) return
    const values = sheet.getDataRange().getValues()
    for (let i = values.length - 1; i >= 1; i--) {
      if (!adId || clean(values[i][1]) === adId) {
        sheet.deleteRow(i + 1)
        removed++
      }
    }
  })
  return { ok: true, removed: removed }
}

// A month cell as "yyyy-MM", whether it's text or Sheets made it a date.
function monthKey(value) {
  if (value instanceof Date) return Utilities.formatDate(value, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM")
  return clean(value).replace(/^'/, "")
}

function readAdStats() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(AD_STATS_SHEET)
  if (!sheet) return []
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => clean(r[1]))
    .map((r) => ({
      month: monthKey(r[0]),
      ad: clean(r[1]),
      title: clean(r[2]),
      views: Number(r[3]) || 0,
      clicks: Number(r[4]) || 0,
      lastClick: r[5] instanceof Date ? r[5].toISOString() : "",
    }))
}

// ---- Admin ----

// Returns an error result if the password is wrong (null when it's fine).
// After 10 wrong tries in 10 minutes, admin is locked for 10 minutes.
function checkAdmin(body) {
  const password = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || ""
  if (!password) {
    return { ok: false, admin: true, error: "Set ADMIN_PASSWORD in the Apps Script's Project Settings > Script Properties first." }
  }
  const cache = CacheService.getScriptCache()
  const fails = Number(cache.get("admin-fails")) || 0
  if (fails >= 10) return { ok: false, admin: true, error: "Too many wrong tries - wait 10 minutes and try again." }
  if (String(body.password || "") !== password) {
    cache.put("admin-fails", String(fails + 1), 600)
    return { ok: false, admin: true, error: "Wrong admin password." }
  }
  return null
}

// ---- News (from the Admin page) ----
// News tab: Article ID | Date | Headline | Image | Article | Featured |
//           Image 2 | Image 2 Caption  (the second photo is optional)

function newsFolder() {
  const folders = DriveApp.getFoldersByName(NEWS_FOLDER)
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(NEWS_FOLDER)
}

function saveImage(folder, base64, prefix) {
  const stamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyyMMdd-HHmmss")
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", prefix + "-" + stamp + ".jpg"))
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  return "https://lh3.googleusercontent.com/d/" + file.getId()
}

// Adds an article (no id) or updates one (id). A new photo replaces the
// old one; without one the current photo is kept.
function saveNews(body) {
  const sheet = sheetById(NEWS_SHEET_ID)
  if (!sheet) return { ok: false, error: "The News tab is missing." }
  if (!clean(sheet.getRange(1, 7).getValue())) sheet.getRange(1, 7).setValue("Image 2")
  if (!clean(sheet.getRange(1, 8).getValue())) sheet.getRange(1, 8).setValue("Image 2 Caption")
  const headline = clean(body.headline)
  if (!headline) return { ok: false, error: "Add a headline." }
  const article = String(body.article || "").trim()
  // Kept as text ("10/25") so Sheets doesn't turn it into a full date.
  const date = /^\d+\/\d+$/.test(clean(body.date)) ? "'" + clean(body.date) : clean(body.date)
  const featured = body.featured ? "Yes" : "No"
  const values = sheet.getDataRange().getValues()
  const id = clean(body.id)

  let image = clean(body.image)
  if (body.imageData) {
    if (String(body.imageData).length > 10 * 1024 * 1024) return { ok: false, error: "That photo is too big." }
    image = hostImage(String(body.imageData), "news", headline)
  }
  let image2 = clean(body.image2)
  if (body.imageData2) {
    if (String(body.imageData2).length > 10 * 1024 * 1024) return { ok: false, error: "The second photo is too big." }
    image2 = hostImage(String(body.imageData2), "news", clean(body.caption2) || headline)
  }
  const caption2 = image2 ? clean(body.caption2).slice(0, 160) : ""

  if (id) {
    for (let i = 1; i < values.length; i++) {
      if (clean(values[i][0]) === id) {
        sheet.getRange(i + 1, 2, 1, 7).setValues([[date, headline, image, article, featured, image2, caption2]])
        return { ok: true, id: id, image: image, image2: image2 }
      }
    }
    return { ok: false, error: "That article isn't on the News tab anymore." }
  }

  let maxId = 0
  values.slice(1).forEach((r) => {
    const n = Number(r[0])
    if (n > maxId) maxId = n
  })
  sheet.appendRow([maxId + 1, date, headline, image, article, featured, image2, caption2])
  return { ok: true, id: String(maxId + 1), image: image, image2: image2 }
}

function deleteNews(body) {
  const sheet = sheetById(NEWS_SHEET_ID)
  if (!sheet) return { ok: false, error: "The News tab is missing." }
  const id = clean(body.id)
  const values = sheet.getDataRange().getValues()
  for (let i = values.length - 1; i >= 1; i--) {
    if (clean(values[i][0]) === id) {
      sheet.deleteRow(i + 1)
      return { ok: true }
    }
  }
  return { ok: false, error: "That article isn't on the News tab." }
}

// ---- Admin editors: Events, Players, Sponsors (ads), Rules ----
//
// The Admin page reads these tabs fresh from here (not the published
// copy, which lags a few minutes) and saves rows back. Only plain cells
// are written - formula cells are never overwritten. New rows copy the
// last filled row first so its formulas carry on.

const ADMIN_SHEETS = {
  events: { id: EVENTS_SHEET_ID, key: "Event ID" },
  players: { id: PLAYERS_SHEET_ID, key: "Player ID" },
  ads: { id: 1618727872, key: "Advertisement #", extraHeaders: ["Start Date", "End Date"] },
  rules: { id: 1947708801, key: "Rule #" },
}

function adminSheet(name) {
  const def = ADMIN_SHEETS[name]
  if (!def) throw new Error("Unknown tab: " + name)
  const sheet = sheetById(def.id)
  if (!sheet) throw new Error("That tab is missing from the sheet.")
  // Columns the editors need that older sheets may not have yet.
  ;(def.extraHeaders || []).forEach((h) => {
    const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(clean)
    if (header.indexOf(h) < 0) sheet.getRange(1, header.filter((x) => x !== "").length + 1).setValue(h).setFontWeight("bold")
  })
  return { sheet: sheet, def: def }
}

// Stops typed text being treated as a formula.
function safeCell(value) {
  const text = value == null ? "" : String(value)
  return /^[=+\-@]/.test(text) && !/^[-+]?\d/.test(text) ? "'" + text : text
}

function adminData(body) {
  const ref = adminSheet(clean(body.sheet))
  const range = ref.sheet.getDataRange()
  const display = range.getDisplayValues()
  const formulas = range.getFormulas()
  const header = display[0].map(clean)
  const rows = []
  for (let i = 1; i < display.length; i++) {
    if (!display[i].some((v) => clean(v))) continue
    const fields = {}
    header.forEach((h, c) => { if (h) fields[h] = display[i][c] })
    rows.push({ fields: fields, formulas: header.filter((h, c) => h && formulas[i][c]) })
  }
  return { ok: true, header: header.filter(Boolean), key: ref.def.key, rows: rows }
}

function saveAdminRow(body) {
  const ref = adminSheet(clean(body.sheet))
  const sheet = ref.sheet
  const range = sheet.getDataRange()
  const values = range.getValues()
  const formulas = range.getFormulas()
  const header = values[0].map(clean)
  const keyCol = header.indexOf(ref.def.key)
  if (keyCol < 0) return { ok: false, error: "The " + ref.def.key + " column is missing." }
  const fields = body.fields || {}
  const key = clean(body.key)

  if (key) {
    const r = values.findIndex((row, i) => i > 0 && clean(row[keyCol]) === key)
    if (r < 0) return { ok: false, error: "That row isn't on the sheet anymore - reload and try again." }
    header.forEach((h, c) => {
      if (!h || !(h in fields) || c === keyCol || formulas[r][c]) return
      sheet.getRange(r + 1, c + 1).setValue(safeCell(fields[h]))
    })
    return { ok: true, key: key }
  }

  // New row: copy the last filled row (formulas carry on), then fill in.
  let last = -1
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i].some((v) => clean(v) !== "")) { last = i; break }
  }
  let maxKey = 0
  values.slice(1).forEach((row) => {
    const n = Number(row[keyCol])
    if (n > maxKey) maxKey = n
  })
  const target = (last >= 1 ? last : 0) + 2
  if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), target - sheet.getMaxRows())
  const width = header.length
  if (last >= 1) sheet.getRange(last + 1, 1, 1, width).copyTo(sheet.getRange(target, 1, 1, width))
  header.forEach((h, c) => {
    if (!h) return
    if (last >= 1 && formulas[last][c]) return
    const value = c === keyCol ? maxKey + 1 : (h in fields ? safeCell(fields[h]) : "")
    sheet.getRange(target, c + 1).setValue(value)
  })
  return { ok: true, key: String(maxKey + 1) }
}

function deleteAdminRow(body) {
  const ref = adminSheet(clean(body.sheet))
  const values = ref.sheet.getDataRange().getValues()
  const keyCol = values[0].map(clean).indexOf(ref.def.key)
  const key = clean(body.key)
  for (let i = values.length - 1; i >= 1; i--) {
    if (clean(values[i][keyCol]) === key) {
      ref.sheet.deleteRow(i + 1)
      return { ok: true }
    }
  }
  return { ok: false, error: "That row isn't on the sheet anymore." }
}

// ---- Course pars (edited under each event) ----

function allPars() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PARS_SHEET)
  if (!sheet) return []
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => clean(r[0]))
    .map((r) => ({ course: clean(r[0]), pars: r.slice(1, 19).map((v) => Number(v) || 0) }))
}

function savePars(body) {
  const course = clean(body.course)
  const pars = (body.pars || []).map((v) => Number(v) || "")
  if (!course || pars.length !== 18) return { ok: false, error: "Pick a course and all 18 pars." }
  let sheet = SpreadsheetApp.getActive().getSheetByName(PARS_SHEET)
  if (!sheet) {
    setup()
    sheet = SpreadsheetApp.getActive().getSheetByName(PARS_SHEET)
  }
  const values = sheet.getDataRange().getValues()
  const wanted = course.toLowerCase()
  for (let i = 1; i < values.length; i++) {
    if (clean(values[i][0]).toLowerCase() === wanted) {
      sheet.getRange(i + 1, 2, 1, 18).setValues([pars])
      return { ok: true }
    }
  }
  sheet.appendRow([course].concat(pars))
  return { ok: true }
}

// ---- Images for the editors ----
// kind "winner" / "ad": a photo in the repo's uploads/ folder.
// kind "headshot": the player's photo and cut-out, also in uploads/ like the
// Gallery (uploads/players/<id>.jpg and uploads/players/cutouts/<id>.png),
// so they show without the website rebuilding.
function uploadAsset(body) {
  const data = String(body.data || "")
  if (!data) return { ok: false, error: "No photo was sent." }
  if (data.length > 10 * 1024 * 1024) return { ok: false, error: "That photo is too big." }
  const kind = clean(body.kind)
  if (kind === "headshot") {
    const id = clean(body.playerId)
    if (!/^\d+$/.test(id)) return { ok: false, error: "Save the player first, then add the photo." }
    githubPut("uploads/players/" + id + ".jpg", data, "Headshot for player " + id)
    if (body.cutout) githubPut("uploads/players/cutouts/" + id + ".png", String(body.cutout), "Cut-out for player " + id)
    return { ok: true }
  }
  return { ok: true, url: hostImage(data, kind === "ad" ? "ad" : "winner", clean(body.title)) }
}

// ---- Site settings (the announcement banner) ----
const SETTINGS_SHEET = "Settings"

function settingsSheet() {
  const book = SpreadsheetApp.getActive()
  let sheet = book.getSheetByName(SETTINGS_SHEET)
  if (!sheet) {
    sheet = book.insertSheet(SETTINGS_SHEET)
    sheet.getRange(1, 1, 1, 2).setValues([["Setting", "Value"]]).setFontWeight("bold")
    sheet.setFrozenRows(1)
  }
  return sheet
}

function readSettings() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET)
  const settings = {}
  if (!sheet) return settings
  sheet.getDataRange().getValues().slice(1).forEach((r) => {
    if (clean(r[0])) settings[clean(r[0])] = String(r[1] == null ? "" : r[1])
  })
  return settings
}

function saveSettings(body) {
  const sheet = settingsSheet()
  const values = sheet.getDataRange().getValues()
  Object.keys(body.values || {}).forEach((key) => {
    const value = safeCell(body.values[key])
    const r = values.findIndex((row, i) => i > 0 && clean(row[0]) === key)
    if (r > 0) sheet.getRange(r + 1, 2).setValue(value)
    else {
      sheet.appendRow([key, value])
      values.push([key, value])
    }
  })
  return { ok: true }
}

// ---- Fix a scorecard (any round, even after it's locked) ----
// Rewrites the team's 18 holes in Live Scores, then (when all 18 are in)
// resubmits it to Hole by Hole and Match Entry. contributionTotals, when
// given, are used for Match Entry instead of the per-hole sums (older
// rounds only have totals).
function adminSaveCard(body) {
  const eventId = clean(body.event)
  const team = clean(body.team)
  if (!eventId || !team) return { ok: false, error: "Pick an event and a team." }
  const strokes = body.strokes || []
  const contributions = body.contributions || []
  for (let h = 1; h <= 18; h++) {
    const s = Number(strokes[h - 1]) || null
    saveHole({
      event: eventId, team: team, course: body.course, players: body.players || [],
      hole: h, strokes: s, contributions: contributions[h - 1] || [0, 0],
    }, true)
  }
  const complete = strokes.filter((s) => Number(s) > 0).length === 18
  if (!complete) return { ok: true, submitted: false }
  const result = submitTeams({
    event: eventId, eventName: body.eventName, course: body.course,
    contributionTotals: body.contributionTotals,
  }, team, true)
  return { ok: result.ok, submitted: result.ok, error: result.error, writes: result.writes }
}

// Deletes every practice-round row from Live Scores.
function clearPractice() {
  const live = liveRows()
  for (let i = live.values.length - 1; i >= 1; i--) {
    if (clean(live.values[i][0]) === PRACTICE_ID) live.sheet.deleteRow(i + 1)
  }
  return { ok: true }
}
