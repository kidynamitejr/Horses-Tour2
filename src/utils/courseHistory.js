// Turns the Hole by Hole tab (one row per team per event, a score over
// par for each of 18 holes) into per-match running totals for the line
// chart, plus per-course records.

export const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

const norm = (value) => (value || "").trim().toLowerCase()

// Blank cells stay null (an unplayed hole is not a 0), and "E" is even
// par in case the sheet's number format displays zero that way.
export function parseScore(value) {

  const text = (value ?? "").toString().trim()

  if (text === "") return null

  if (text.toUpperCase() === "E") return 0

  const num = parseFloat(text)

  return isNaN(num) ? null : num

}

// Golf-style over/under: +3, -2, or E for even.
export function formatOverPar(value, digits = 0) {

  if (value === null || value === undefined || isNaN(value)) return "-"

  const rounded = Number(value.toFixed(digits))

  if (rounded === 0) return "E"

  return rounded > 0 ? `+${rounded.toFixed(digits)}` : rounded.toFixed(digits)

}

// "M/D/YY" dates - split by hand since browsers disagree on how to expand
// a 2-digit year.
function getEventYear(dateStr) {

  const parts = (dateStr || "").split("/")

  if (parts.length !== 3) return ""

  const year = parts[2].trim()

  return year.length === 2 ? `20${year}` : year

}

// The Team column is a formula in the sheet - if it errors or is blank,
// fall back to the team letter instead of showing "#N/A".
export function cleanTeamName(name, letter) {

  const text = (name || "").trim()

  return !text || text.startsWith("#") ? `Team ${letter}` : text

}

function buildTeam(row) {

  const scores = HOLES.map((hole) => parseScore(row[`Hole ${hole}`]))

  let running = 0
  let gap = false

  // Running total after each hole. Once a hole is missing the total
  // isn't known anymore, so everything after it stays blank.
  const cumulative = scores.map((score) => {

    if (gap || score === null) {
      gap = true
      return null
    }

    running += score

    return running

  })

  const holesPlayed = cumulative.filter((value) => value !== null).length

  if (holesPlayed === 0) return null

  const letter = (row["Team letter"] || "").trim()

  return {
    letter,
    name: cleanTeamName(row.Team, letter),
    scores,
    cumulative,
    holesPlayed,
    complete: holesPlayed === HOLES.length,
    total: cumulative[holesPlayed - 1],
  }

}

function formatHoles(holes) {

  if (holes.length === 1) return `Hole ${holes[0]}`

  const head = holes.slice(0, -1).join(", ")

  return `Holes ${head} & ${holes[holes.length - 1]}`

}

function getCourseRecords(course, courseMatches) {

  const teamRounds = courseMatches.flatMap((match) =>
    match.teams.map((team) => ({ ...team, eventName: match.eventName }))
  )

  const completeRounds = teamRounds.filter((team) => team.complete)

  // Average over par for each hole across every team that played it.
  const holeAverages = HOLES.map((hole) => {

    const values = teamRounds
      .map((team) => team.scores[hole - 1])
      .filter((score) => score !== null)

    return {
      hole,
      count: values.length,
      average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
    }

  }).filter((entry) => entry.count > 0)

  let hardest = null
  let easiest = null

  if (holeAverages.length > 0) {

    const max = Math.max(...holeAverages.map((entry) => entry.average))
    const min = Math.min(...holeAverages.map((entry) => entry.average))

    // If every hole averaged the same there's no meaningful hardest or
    // easiest.
    if (max !== min) {

      hardest = {
        holes: holeAverages.filter((entry) => entry.average === max).map((entry) => entry.hole),
        average: max,
      }

      easiest = {
        holes: holeAverages.filter((entry) => entry.average === min).map((entry) => entry.hole),
        average: min,
      }

    }

  }

  let bestRound = null
  let averageRound = null
  let mostUnderPar = null

  if (completeRounds.length > 0) {

    const totals = completeRounds.map((team) => team.total)
    const best = Math.min(...totals)

    bestRound = {
      total: best,
      teams: completeRounds.filter((team) => team.total === best),
    }

    averageRound = totals.reduce((a, b) => a + b, 0) / totals.length

    const underCounts = completeRounds.map((team) => team.scores.filter((score) => score < 0).length)
    const mostUnder = Math.max(...underCounts)

    if (mostUnder > 0) {

      mostUnderPar = {
        count: mostUnder,
        teams: completeRounds.filter((team, index) => underCounts[index] === mostUnder),
      }

    }

  }

  return {
    course,
    matchCount: courseMatches.length,
    teamRoundCount: teamRounds.length,
    hardest: hardest && { ...hardest, label: formatHoles(hardest.holes) },
    easiest: easiest && { ...easiest, label: formatHoles(easiest.holes) },
    bestRound,
    averageRound,
    mostUnderPar,
  }

}

// holeRows: Hole by Hole tab rows. events: Events tab rows (used to get
// each match's date/course/order by matching on event name).
export function getCourseHistory(holeRows, events) {

  const eventByName = {}

  events.forEach((event) => {
    eventByName[norm(event["Event Name"])] = event
  })

  const groups = new Map()

  holeRows.forEach((row) => {

    const key = norm(row["Event Name"])

    if (!key) return

    const team = buildTeam(row)

    // Rows with no scores yet (an event that's set up but not entered)
    // don't count as a match.
    if (!team) return

    if (!groups.has(key)) {
      groups.set(key, { displayName: (row["Event Name"] || "").trim(), teams: [] })
    }

    groups.get(key).teams.push(team)

  })

  const matches = [...groups.entries()].map(([key, group]) => {

    const event = eventByName[key]

    const teams = group.teams.sort((a, b) => a.letter.localeCompare(b.letter))

    const complete = teams.filter((team) => team.complete)

    let lowRound = null

    if (complete.length > 0) {

      const best = Math.min(...complete.map((team) => team.total))

      lowRound = {
        total: best,
        names: complete.filter((team) => team.total === best).map((team) => team.name),
      }

    }

    return {
      key,
      eventName: event ? (event["Event Name"] || "").trim() : group.displayName,
      eventId: event ? Number(event["Event ID"]) : null,
      date: event ? event.Date : "",
      year: event ? getEventYear(event.Date) : "",
      course: event ? (event.Course || "").trim() : "",
      teams,
      lowRound,
    }

  })

  // Most recent event first, same as Past Matches / Hall of Champions.
  matches.sort((a, b) => (b.eventId ?? -1) - (a.eventId ?? -1))

  // Hole numbers only mean something within a single course, so the
  // records are grouped by course rather than blended tour-wide.
  const byCourse = new Map()

  matches.forEach((match) => {

    const label = match.course || match.eventName
    const key = norm(label)

    if (!byCourse.has(key)) byCourse.set(key, { label, matches: [] })

    byCourse.get(key).matches.push(match)

  })

  const courses = [...byCourse.values()].map((entry) => getCourseRecords(entry.label, entry.matches))

  return { matches, courses }

}
