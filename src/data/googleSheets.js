import axios from "axios"

// ==============================
// SHEET URLS
// ==============================

const PLAYERS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=0&single=true&output=csv"

const RANKINGS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1178466577&single=true&output=csv"

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=102645129&single=true&output=csv"

const EVENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=898289286&single=true&output=csv"

const PLAYER_STATS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1392756262&single=true&output=csv"

const NEWS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1649176247&single=true&output=csv"

const PLAYER_HISTORY_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=2001911152&single=true&output=csv"

const RULES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1947708801&single=true&output=csv"

const TOUR_RECORDS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=774744327&single=true&output=csv"

const MATCH_RESULTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1586411260&single=true&output=csv"

const GALLERY_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=4188486&single=true&output=csv"

const CONTRIBUTIONS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=644588552&single=true&output=csv"

const MATCH_ENTRY_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1996241982&single=true&output=csv"

const TEAM_PAIRING_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1241601970&single=true&output=csv"

const ADVERTISEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=1618727872&single=true&output=csv"

const HOLE_BY_HOLE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaRzObvMpmjQNGdhCQZUoiwazKtbfL2t5tnf7n7nr34NvQQYrL9_dvNEJ_U1s0W5FMA_6V9N9S0GdY/pub?gid=108366969&single=true&output=csv"

// ==============================
// CSV PARSER
// ==============================
// Parses the whole CSV body at once (rather than splitting by newline
// first) so quoted fields containing literal newlines parse correctly.

function parseCSV(text) {

  const rows = []
  let row = []
  let field = ""
  let insideQuotes = false

  for (let i = 0; i < text.length; i++) {

    const char = text[i]
    const next = text[i + 1]

    if (insideQuotes) {

      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        insideQuotes = false
      } else {
        field += char
      }

    } else if (char === '"') {

      insideQuotes = true

    } else if (char === ",") {

      row.push(field.trim())
      field = ""

    } else if (char === "\n") {

      row.push(field.trim())
      rows.push(row)
      row = []
      field = ""

    } else if (char === "\r") {

      // skip

    } else {

      field += char

    }

  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }

  return rows

}

// ==============================
// GENERIC CSV READER
// ==============================

async function readCSV(url) {

  const response = await axios.get(url)

  const rows = parseCSV(response.data.trim())

  if (rows.length === 0) return []

  const headers = rows[0]

  return rows.slice(1).map(values => {

    const obj = {}

    headers.forEach((header, index) => {

      obj[header.trim()] = (values[index] || "").trim()

    })

    return obj

  })

}

// ==============================
// EXPORTS
// ==============================

export async function getPlayers() {
  return await readCSV(PLAYERS_URL)
}

export async function getPlayerStats() {
  return await readCSV(PLAYER_STATS_URL)
}

export async function getRankings() {
  return await readCSV(RANKINGS_URL)
}

export async function getSchedule() {
  return await readCSV(SCHEDULE_URL)
}

export async function getEvents() {
  return await readCSV(EVENTS_URL)
}

export async function getNews() {
  return await readCSV(NEWS_URL)
}

export async function getPlayerHistory() {
  return await readCSV(PLAYER_HISTORY_URL)
}

export async function getRules() {
  return await readCSV(RULES_URL)
}

export async function getTourRecords() {
  return await readCSV(TOUR_RECORDS_URL)
}

export async function getMatchResults() {
  return await readCSV(MATCH_RESULTS_URL)
}

export async function getGallery() {
  return await readCSV(GALLERY_URL)
}

export async function getContributions() {
  return await readCSV(CONTRIBUTIONS_URL)
}

export async function getMatchEntry() {
  return await readCSV(MATCH_ENTRY_URL)
}

// Returns the Team Pairing tab as a raw grid (array of row arrays)
// instead of header-keyed objects, since that tab stacks several small
// tables (name-swap list, Auto Matchmaking, Hard Key Matchmaking) rather
// than having one table with a single header row.
export async function getTeamPairingGrid() {
  const response = await axios.get(TEAM_PAIRING_URL)
  return parseCSV(response.data.trim())
}

export async function getAdvertisements() {
  return await readCSV(ADVERTISEMENTS_URL)
}

export async function getHoleByHole() {
  return await readCSV(HOLE_BY_HOLE_URL)
}