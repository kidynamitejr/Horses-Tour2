import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { getPlayers, getMatchEntry, getEvents } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { getPlayerWinnings, formatCurrency } from "../utils/winnings"
import { getMajorWins } from "../utils/majors"

// The sheet's Contribution % column is only formatted as a percent for
// the very first event; every event after that is a raw decimal fraction
// (e.g. "0.6481481481" instead of "64.81%") - same parsing used on the
// match recap and the badge calculations.
function parseContributionPercent(value) {
  if (value === "" || value === null || value === undefined) return null
  const str = String(value).trim()
  const num = str.endsWith("%") ? parseFloat(str) : parseFloat(str) * 100
  return isNaN(num) ? null : num
}

// Builds every stat row shown in the comparison table. "higher" decides
// which side gets highlighted as the winner of that row - some stats
// (like Lowest Round, which is points-per-match) don't have a strictly
// "better direction" so those are left neutral.
function buildRows(a, b) {
  return [
    { label: "Rank", key: "rank", higher: false, format: (v) => v ?? "-" },
    { label: "Career Winnings", key: "winnings", higher: true, format: formatCurrency },
    { label: "Ranking Factor", key: "avgRankingPoints", higher: true, format: (v) => v ?? "-" },
    { label: "Events Played", key: "eventsPlayed", higher: true, format: (v) => v ?? 0 },
    { label: "Majors Won", key: "majorWins", higher: true, format: (v) => v ?? 0 },
    { label: "Wins", key: "wins", higher: true, format: (v) => v ?? 0 },
    { label: "Runner Ups", key: "runnerUps", higher: true, format: (v) => v ?? 0 },
    { label: "Top 3 Finishes", key: "topThree", higher: true, format: (v) => v ?? 0 },
    { label: "Highest Round", key: "highest", higher: true, format: (v) => (v !== null && v !== undefined ? v.toFixed(2) : "-") },
    { label: "Last Match Contributions", key: "lastMatchContributions", higher: true, format: (v) => v ?? "-" },
    { label: "Last Match Contribution %", key: "lastMatchContributionPercent", higher: true, format: (v) => (v !== null && v !== undefined ? `${v.toFixed(1)}%` : "-") },
  ].map((row) => {
    const aVal = a?.[row.key]
    const bVal = b?.[row.key]
    let winner = null
    if (row.higher !== null && typeof aVal === "number" && typeof bVal === "number" && aVal !== bVal) {
      winner = row.higher ? (aVal > bVal ? "a" : "b") : (aVal < bVal ? "a" : "b")
    }
    return { ...row, aVal, bVal, winner }
  })
}

function PlayerColumn({ player }) {
  if (!player) {
    return (
      <div className="compare-player-empty">
        <div className="compare-player-empty-avatar">?</div>
        <p>Pick a player</p>
      </div>
    )
  }

  return (
    <div className="compare-player-column">
      <img
        src={`${import.meta.env.BASE_URL}images/players/${player["Player ID"]}.jpg`}
        alt={player.Name}
        className="compare-player-avatar"
        onError={(e) => {
          e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
        }}
      />
      <h3>{player.Name}</h3>
    </div>
  )
}

function ComparePlayers() {

  const [searchParams] = useSearchParams()
  const [players, setPlayers] = useState([])
  const [statsByName, setStatsByName] = useState({})
  const [loading, setLoading] = useState(true)
  const [idA, setIdA] = useState(searchParams.get("a") || "")
  const [idB, setIdB] = useState(searchParams.get("b") || "")

  useEffect(() => {

    async function loadData() {

      try {

        const [playerList, matchEntry, events] = await Promise.all([
          getPlayers(),
          getMatchEntry(),
          getEvents(),
        ])

        const rankable = playerList.filter((p) => !/\(sub\)/i.test(p.Name))

        setPlayers(rankable)

        const summaries = getPlayerSummaries(matchEntry)
        const winningsByPlayer = getPlayerWinnings(events)
        const majorWinsByPlayer = getMajorWins(events)

        // Rank is computed live from Ranking Factor across every
        // non-sub player who has actually played, same as everywhere
        // else on the site.
        const ranked = Object.entries(summaries)
          .filter(([n]) => !/\(sub\)/i.test(n))
          .map(([n, s]) => ({ name: n, ...s }))
          .filter((p) => p.eventsPlayed > 0)
          .sort((a, b) => b.avgRankingPoints - a.avgRankingPoints)

        const rankByName = {}
        ranked.forEach((p, i) => { rankByName[p.name] = i + 1 })

        const playedByName = {}
        const lastMatchByName = {}

        matchEntry
          .filter((row) => row.Player && row.Contributions)
          .forEach((row) => {

            const name = row.Player.trim()

            if (!playedByName[name]) playedByName[name] = []
            playedByName[name].push(parseFloat(row["Match Ranking Points"]) || 0)

            const eventId = Number(row["Event ID"])

            if (!lastMatchByName[name] || eventId > lastMatchByName[name].eventId) {
              lastMatchByName[name] = {
                eventId,
                contributions: parseFloat(row.Contributions),
                contributionPercent: parseContributionPercent(row["Contribution %"]),
              }
            }

          })

        const combined = {}

        rankable.forEach((p) => {
          const name = p.Name.trim()
          const summary = summaries[name]
          const rounds = playedByName[name] || []
          const lastMatch = lastMatchByName[name]
          combined[name] = {
            rank: rankByName[name] ?? null,
            winnings: winningsByPlayer[name] || 0,
            majorWins: majorWinsByPlayer[name] || 0,
            avgRankingPoints: summary?.avgRankingPoints ?? 0,
            eventsPlayed: summary?.eventsPlayed ?? 0,
            wins: summary?.wins ?? 0,
            runnerUps: summary?.runnerUps ?? 0,
            topThree: summary?.topThree ?? 0,
            highest: rounds.length > 0 ? Math.max(...rounds) : null,
            lastMatchContributions: lastMatch && !isNaN(lastMatch.contributions) ? lastMatch.contributions : null,
            lastMatchContributionPercent: lastMatch ? lastMatch.contributionPercent : null,
          }
        })

        setStatsByName(combined)

      } catch (error) {

        console.error("Compare Players Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadData()

  }, [])

  const playerA = players.find((p) => String(p["Player ID"]) === idA)
  const playerB = players.find((p) => String(p["Player ID"]) === idB)

  const statsA = playerA ? statsByName[playerA.Name.trim()] : null
  const statsB = playerB ? statsByName[playerB.Name.trim()] : null

  const rows = buildRows(statsA, statsB)

  return (

    <section className="card">

      <h2>Compare Players</h2>

      {loading ? (

        <p>Loading players...</p>

      ) : (

        <>

          <div className="compare-picker-row">

            <select
              className="compare-picker"
              value={idA}
              onChange={(e) => setIdA(e.target.value)}
            >
              <option value="">Select Player A</option>
              {players.map((p) => (
                <option key={p["Player ID"]} value={p["Player ID"]}>
                  {p.Name}
                </option>
              ))}
            </select>

            <span className="compare-picker-vs">VS</span>

            <select
              className="compare-picker"
              value={idB}
              onChange={(e) => setIdB(e.target.value)}
            >
              <option value="">Select Player B</option>
              {players.map((p) => (
                <option key={p["Player ID"]} value={p["Player ID"]}>
                  {p.Name}
                </option>
              ))}
            </select>

          </div>

          <div className="compare-columns">
            <PlayerColumn player={playerA} />
            <div className="compare-columns-divider">VS</div>
            <PlayerColumn player={playerB} />
          </div>

          {playerA && playerB && (

            <div className="compare-table">

              {rows.map((row) => (

                <div className="compare-row" key={row.label}>

                  <div className={`compare-cell compare-cell-a${row.winner === "a" ? " compare-cell-winner" : ""}`}>
                    {row.format(row.aVal)}
                  </div>

                  <div className="compare-cell compare-cell-label">
                    {row.label}
                  </div>

                  <div className={`compare-cell compare-cell-b${row.winner === "b" ? " compare-cell-winner" : ""}`}>
                    {row.format(row.bVal)}
                  </div>

                </div>

              ))}

            </div>

          )}

        </>

      )}

    </section>

  )

}

export default ComparePlayers
