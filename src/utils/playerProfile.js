// Builds everything the player profile page shows - for every player at
// once, so each stat can also be ranked against the rest of the tour.
//
// Sources:
//   Players      - name, join date, date born, home course
//   Match Entry  - one row per player per event (team, placement, points)
//   Events       - event name/date/course/type, winner and payout
//   Hole by Hole - one row per team per event, a score over par per hole

import { getPlayedMatchEntryRows } from "./matchEntry"
import { HOLES, parseScore } from "./courseHistory"
import { ordinal } from "./ordinal"

const isSub = (name) => /\(sub\)/i.test(name || "")
const norm = (value) => (value || "").trim().toLowerCase()

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

// "Sept 27, 2002" / "Aug 9, 2000" - parsed by hand because browsers don't
// agree on abbreviations like "Sept".
export function parseBirthDate(text) {
  const match = (text || "").trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (!match) return null
  const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase())
  if (month === -1) return null
  return new Date(Number(match[3]), month, Number(match[2]))
}

export function getAge(birthDate, today = new Date()) {
  if (!birthDate) return null
  let age = today.getFullYear() - birthDate.getFullYear()
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  return beforeBirthday ? age - 1 : age
}

// "M/D/YY" event dates.
function parseEventDate(text) {
  const parts = (text || "").split("/").map((p) => p.trim())
  if (parts.length !== 3) return null
  const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2])
  return new Date(year, Number(parts[0]) - 1, Number(parts[1]))
}

// The sheet's Contribution % is "64.81%" for some events and a raw
// fraction ("0.6481") for others.
function parseContribution(value) {
  const str = String(value ?? "").trim()
  if (!str) return null
  const num = str.endsWith("%") ? parseFloat(str) : parseFloat(str) * 100
  return isNaN(num) ? null : num
}

function findWinningsKey(row) {
  return row ? Object.keys(row).find((key) => /winnings/i.test(key)) : null
}

function money(value) {
  const num = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function average(values) {
  const list = values.filter((v) => v !== null && v !== undefined && !isNaN(v))
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null
}

// "T2"-style rank among every value in the list (ties share a rank).
// `higherIsBetter` decides the sort direction.
function rankOf(value, allValues, higherIsBetter) {
  if (value === null || value === undefined) return null
  const valid = allValues.filter((v) => v !== null && v !== undefined)
  const better = valid.filter((v) => (higherIsBetter ? v > value : v < value)).length
  const tied = valid.filter((v) => v === value).length
  return { position: better + 1, tied: tied > 1, of: valid.length }
}

export function formatRank(rank) {
  if (!rank) return "-"
  return rank.tied ? `T${rank.position}` : ordinal(rank.position)
}

export function formatToPar(value) {
  if (value === null || value === undefined || isNaN(value)) return "-"
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return "E"
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  return rounded > 0 ? `+${text}` : text
}

// Hole-by-hole numbers for every team round a player was part of.
function getHoleStats(name, holeRows) {
  const rounds = holeRows
    .filter((row) =>
      (row.Team || "")
        .split("/")
        .map(norm)
        .includes(norm(name))
    )
    .map((row) => ({
      eventName: (row["Event Name"] || "").trim(),
      scores: HOLES.map((hole) => parseScore(row[`Hole ${hole}`])),
    }))
    .filter((round) => round.scores.every((score) => score !== null))

  if (rounds.length === 0) return null

  const all = rounds.flatMap((round) => round.scores)
  const count = (test) => all.filter(test).length

  const birdies = count((s) => s < 0)
  const pars = count((s) => s === 0)
  const bogeys = count((s) => s === 1)
  const doubles = count((s) => s >= 2)

  const front = rounds.map((r) => r.scores.slice(0, 9).reduce((a, b) => a + b, 0))
  const back = rounds.map((r) => r.scores.slice(9).reduce((a, b) => a + b, 0))

  return {
    rounds: rounds.length,
    holes: all.length,
    birdies,
    pars,
    bogeys,
    doubles,
    birdiesPerRound: birdies / rounds.length,
    parOrBetterPct: ((birdies + pars) / all.length) * 100,
    bogeysPerRound: (bogeys + doubles) / rounds.length,
    frontNineAvg: average(front),
    backNineAvg: average(back),
    roundAvg: average(rounds.map((r) => r.scores.reduce((a, b) => a + b, 0))),
  }
}

export function buildPlayerProfiles({ players, matchEntry, events, holeRows }) {

  const playedRows = getPlayedMatchEntryRows(matchEntry)
  const winningsKey = findWinningsKey(events[0])

  const eventById = {}
  events.forEach((event) => {
    if (event["Event ID"]) eventById[String(event["Event ID"]).trim()] = event
  })

  const profiles = {}

  players.forEach((player) => {

    const name = (player.Name || "").trim()
    if (!name) return

    const birthDate = parseBirthDate(player["Date Born"])
    const homeCourse = (player["Home Course"] || "").trim()

    const results = playedRows
      .filter((row) => norm(row.Player) === norm(name))
      .map((row) => {

        const eventId = String(row["Event ID"]).trim()
        const event = eventById[eventId] || {}
        const team = (row.Team || "").trim()
        const type = (event["Event Type"] || "").trim()
        const isMajor = ["major", "championship"].includes(type.toLowerCase())

        const partners = playedRows
          .filter(
            (other) =>
              String(other["Event ID"]).trim() === eventId &&
              (other.Team || "").trim() === team &&
              norm(other.Player) !== norm(name)
          )
          .map((other) => other.Player.trim())

        const winners = (event.Winner || "").split("/").map(norm)
        const wonEvent = winners.includes(norm(name))

        return {
          eventId: Number(eventId),
          eventName: (event["Event Name"] || `Event ${eventId}`).trim(),
          date: event.Date || "",
          dateValue: parseEventDate(event.Date),
          course: (event.Course || "").trim(),
          type: type || "Regular",
          isMajor,
          team,
          partners,
          placement: Number(row.Placement) || null,
          totalTeams: Number(row["Total Teams"]) || null,
          teamScore: row["Team Score"] !== "" && !isNaN(parseFloat(row["Team Score"]))
            ? parseFloat(row["Team Score"])
            : null,
          contribution: parseContribution(row["Contribution %"]),
          multiplier: parseFloat(row.Multiplier) || 1,
          powerPoints: parseFloat(row["Power Score Earned"]) || 0,
          rankingPoints: parseFloat(row["Match Ranking Points"]) || 0,
          winnings: wonEvent && winningsKey ? money(event[winningsKey]) : 0,
        }

      })
      .sort((a, b) => a.eventId - b.eventId)

    const wins = results.filter((r) => r.placement === 1)

    const scored = results.filter((r) => r.teamScore !== null)
    const lowest = scored.length
      ? scored.reduce((best, r) => (r.teamScore < best.teamScore ? r : best))
      : null

    const bestPoints = results.length
      ? results.reduce((best, r) => (r.rankingPoints > best.rankingPoints ? r : best))
      : null

    const seasons = {}
    results.forEach((r) => {
      const year = r.dateValue ? r.dateValue.getFullYear() : "Unknown"
      if (!seasons[year]) seasons[year] = []
      seasons[year].push(r)
    })

    const summarize = (list) => ({
      events: list.length,
      wins: list.filter((r) => r.placement === 1).length,
      runnerUps: list.filter((r) => r.placement === 2).length,
      thirds: list.filter((r) => r.placement === 3).length,
      topThree: list.filter((r) => r.placement && r.placement <= 3).length,
      majors: list.filter((r) => r.placement === 1 && r.isMajor).length,
      winnings: list.reduce((sum, r) => sum + r.winnings, 0),
      powerPoints: list.reduce((sum, r) => sum + r.powerPoints, 0),
      rankingPoints: list.reduce((sum, r) => sum + r.rankingPoints, 0),
    })

    const career = summarize(results)

    profiles[name] = {
      id: player["Player ID"],
      name,
      isSub: isSub(name),
      active: (player.Active || "").trim(),
      joinDate: (player["Join Date"] || "").trim(),
      bornText: (player["Date Born"] || "").trim(),
      age: getAge(birthDate),
      homeCourse: homeCourse && !/^n\/?a$/i.test(homeCourse) ? homeCourse : "",
      results,
      career,
      seasons: Object.fromEntries(
        Object.entries(seasons).map(([year, list]) => [year, summarize(list)])
      ),
      wins,
      lastWin: wins.length ? wins[wins.length - 1] : null,
      lowestRound: lowest,
      bestPointsEvent: bestPoints,
      averages: {
        rankingFactor: results.length ? career.rankingPoints / results.length : null,
        finish: average(results.map((r) => r.placement)),
        contribution: average(results.map((r) => r.contribution)),
        teamScore: average(results.map((r) => r.teamScore)),
        powerPoints: results.length ? career.powerPoints / results.length : null,
      },
      holeStats: getHoleStats(name, holeRows),
    }

  })

  // Tour-wide ranks among regular (non-sub) players who have played.
  const field = Object.values(profiles).filter((p) => !p.isSub && p.results.length > 0)

  const STAT_DEFS = {
    rankingFactor: { get: (p) => p.averages.rankingFactor, higherIsBetter: true },
    rankingPoints: { get: (p) => p.career.rankingPoints, higherIsBetter: true },
    powerPoints: { get: (p) => p.career.powerPoints, higherIsBetter: true },
    powerPerEvent: { get: (p) => p.averages.powerPoints, higherIsBetter: true },
    contribution: { get: (p) => p.averages.contribution, higherIsBetter: true },
    finish: { get: (p) => p.averages.finish, higherIsBetter: false },
    teamScore: { get: (p) => p.averages.teamScore, higherIsBetter: false },
    winnings: { get: (p) => p.career.winnings, higherIsBetter: true },
    birdiesPerRound: { get: (p) => p.holeStats?.birdiesPerRound ?? null, higherIsBetter: true },
    parOrBetterPct: { get: (p) => p.holeStats?.parOrBetterPct ?? null, higherIsBetter: true },
    bogeysPerRound: { get: (p) => p.holeStats?.bogeysPerRound ?? null, higherIsBetter: false },
    frontNineAvg: { get: (p) => p.holeStats?.frontNineAvg ?? null, higherIsBetter: false },
    backNineAvg: { get: (p) => p.holeStats?.backNineAvg ?? null, higherIsBetter: false },
    roundAvg: { get: (p) => p.holeStats?.roundAvg ?? null, higherIsBetter: false },
  }

  const tourAverages = {}

  Object.entries(STAT_DEFS).forEach(([key, def]) => {
    const values = field.map(def.get)
    tourAverages[key] = average(values)
    field.forEach((p) => {
      p.ranks = p.ranks || {}
      p.ranks[key] = rankOf(def.get(p), values, def.higherIsBetter)
    })
  })

  // Overall tour rank = Ranking Factor order, same as the Horsewide
  // Leaderboard.
  field.forEach((p) => {
    p.tourRank = p.ranks.rankingFactor
  })

  return { profiles, tourAverages, fieldSize: field.length }

}
