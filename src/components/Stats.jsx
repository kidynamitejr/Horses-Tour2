import { useEffect, useState } from "react"
import { getPlayerStats, getContributions, getMatchEntry, getHoleByHole } from "../data/googleSheets"
import { getMatchmakingPointsByPlayer } from "../utils/matchmakingPoints"
import { getPlayerSummaries, getPlayedMatchEntryRows } from "../utils/matchEntry"
import { HOLES, parseScore, cleanTeamName } from "../utils/courseHistory"

// Counts each team's under-par holes (birdie or better) in every round on
// the Hole by Hole tab and returns the highest count, with the teams and
// events it happened at.
function getMostBirdiesInRound(holeRows) {

  const rounds = holeRows
    .filter((row) => row["Event Name"])
    .map((row) => {

      const letter = (row["Team letter"] || "").trim()

      return {
        name: `${cleanTeamName(row.Team, letter)} (${row["Event Name"].trim()})`,
        value: HOLES.filter((hole) => parseScore(row[`Hole ${hole}`]) < 0).length,
      }

    })

  return getLeadersFromEntries(rounds)

}

// Longest run of back-to-back top-3 finishes per player, in Event ID
// order. Only events the player actually played count, so sitting one
// out doesn't break a streak.
function getLongestTopThreeStreaks(matchEntry) {

  const rowsByPlayer = {}

  getPlayedMatchEntryRows(matchEntry).forEach((row) => {

    const name = row.Player.trim()

    if (/\(sub\)/i.test(name)) return

    if (!rowsByPlayer[name]) rowsByPlayer[name] = []

    rowsByPlayer[name].push(row)

  })

  return getLeadersFromEntries(
    Object.entries(rowsByPlayer).map(([name, rows]) => {

      let current = 0
      let longest = 0

      rows
        .sort((a, b) => Number(a["Event ID"]) - Number(b["Event ID"]))
        .forEach((row) => {

          const placement = Number(row.Placement)

          current = placement >= 1 && placement <= 3 ? current + 1 : 0
          longest = Math.max(longest, current)

        })

      return { name, value: longest }

    })
  )

}

// Finds the single lowest Team Score in Match Entry (ignoring
// future/unplayed rows, which have a blank score) and returns everyone
// who was on that team.
function getLowestTeamScore(matchEntry) {

  const valid = matchEntry
    .filter((row) => row["Team Score"] && !isNaN(parseFloat(row["Team Score"])))
    .map((row) => ({
      team: row.Team,
      player: row.Player,
      score: parseFloat(row["Team Score"]),
    }))

  if (valid.length === 0) {
    return { score: null, players: [] }
  }

  const min = Math.min(...valid.map((r) => r.score))

  const players = valid
    .filter((r) => r.score === min)
    .map((r) => r.player)

  return { score: min, players }

}

function getLeadersFromEntries(entries) {

  const valid = entries.filter((e) => !isNaN(e.value))

  if (valid.length === 0) {
    return { value: null, names: [] }
  }

  const max = Math.max(...valid.map((e) => e.value))

  if (max === 0) {
    return { value: 0, names: [] }
  }

  const names = valid
    .filter((e) => e.value === max)
    .map((e) => e.name)

  return { value: max, names }

}

function getLeaders(players, field) {
  return getLeadersFromEntries(
    players.map((p) => ({ name: p.Player, value: parseFloat(p[field]) }))
  )
}

function formatScore(value) {
  if (value === null) return "-"
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatOverPar(value) {
  if (value === null) return "-"
  const formatted = formatScore(value)
  return value >= 0 ? `+${formatted}` : formatted
}

function Stats() {

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadRecords() {

      try {

        const [playerStats, contributions, matchEntry, holeRows] = await Promise.all([
          getPlayerStats(),
          getContributions(),
          getMatchEntry(),
          getHoleByHole(),
        ])

        const lowestTeamScore = getLowestTeamScore(matchEntry)

        const highestSingleEvent = getLeaders(playerStats, "Highest Round Points")

        const summaries = getPlayerSummaries(matchEntry)

        // Computed from Contributions (only rows where Contributions is
        // filled in) rather than the sheet's own Average Points column,
        // since that column divides by Events Played even when a future
        // event's blank row is included in the count.
        const matchmakingPointsByPlayer = getMatchmakingPointsByPlayer(contributions)
        const averagePoints = getLeadersFromEntries(
          Object.entries(matchmakingPointsByPlayer).map(([name, value]) => ({ name, value }))
        )

        // Wins/Runner Ups/Top 3 come from Match Entry (like the rest of
        // the site) instead of the old Match Results tab, which stopped
        // being updated after the first two events.
        const rankableEntries = Object.entries(summaries)
          .filter(([name]) => !/\(sub\)/i.test(name))

        const wins = getLeadersFromEntries(
          rankableEntries.map(([name, s]) => ({ name, value: s.wins }))
        )

        const runnerUps = getLeadersFromEntries(
          rankableEntries.map(([name, s]) => ({ name, value: s.runnerUps }))
        )

        const topThree = getLeadersFromEntries(
          rankableEntries.map(([name, s]) => ({ name, value: s.topThree }))
        )

        const topThreeStreak = getLongestTopThreeStreaks(matchEntry)

        const mostBirdies = getMostBirdiesInRound(holeRows)

        const combined = []

        combined.push({
          Record: "Best Team Score",
          Score: formatOverPar(lowestTeamScore.score),
          Team: lowestTeamScore.players.join(", "),
        })

        combined.push(
          {
            Record: "Highest Single Event Points",
            Score: formatScore(highestSingleEvent.value),
            Team: highestSingleEvent.names.join(", "),
          },
          {
            Record: "Highest Average Points",
            Score: formatScore(averagePoints.value),
            Team: averagePoints.names.join(", "),
          },
          {
            Record: "Most Wins",
            Score: formatScore(wins.value),
            Team: wins.names.join(", "),
          },
          {
            Record: "Most Runner Ups",
            Score: formatScore(runnerUps.value),
            Team: runnerUps.names.join(", "),
          },
          {
            Record: "Most Top 3 Finishes",
            Score: formatScore(topThree.value),
            Team: topThree.names.join(", "),
          },
          {
            Record: "Longest Top 3 Streak",
            Score: formatScore(topThreeStreak.value),
            Team: topThreeStreak.names.join(", "),
          },
          {
            Record: "Most Birdies in a Game",
            Score: formatScore(mostBirdies.value),
            Team: mostBirdies.names.join(", "),
          }
        )

        setRecords(combined)

      } catch (error) {

        console.error("Stats Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadRecords()

  }, [])

  return (

    <section className="card">


      <h2>
        Tour Statistics
      </h2>


      {loading && (
        <p>Loading stats...</p>
      )}


      <div className="stats-grid">


        {!loading && records.map((record) => (


          <div
            className="stat-card"
            key={record.Record}
          >


            <h3>
              {record.Record}
            </h3>

            <p className="stat-value">
              {record.Score}
            </p>

            <p className="stat-team">
              {record.Team}
            </p>


          </div>


        ))}


      </div>


    </section>

  )

}


export default Stats
