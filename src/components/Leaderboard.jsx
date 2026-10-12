import { useEffect, useState } from "react"
import { getPlayers, getMatchEntry } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"

// Ranks every player by their average Match Ranking Points using only
// played rows through (and including) maxEventId - lets us reconstruct
// what the Ranking Factor standings looked like as of a past event, since
// Match Entry only stores the final season-cumulative average on every row.
function getRanksThroughEvent(playedRows, maxEventId) {

  const totals = {}

  playedRows
    .filter((row) => Number(row["Event ID"]) <= maxEventId)
    .forEach((row) => {

      const name = row.Player.trim()

      if (!totals[name]) totals[name] = { sum: 0, count: 0 }

      totals[name].sum += parseFloat(row["Match Ranking Points"]) || 0
      totals[name].count += 1

    })

  const ranked = Object.entries(totals)
    .map(([name, t]) => ({ name, avg: t.sum / t.count }))
    .sort((a, b) => b.avg - a.avg)

  const rankByName = {}

  ranked.forEach((player, index) => {
    rankByName[player.name] = index + 1
  })

  return rankByName

}

function Leaderboard() {

  const [players, setPlayers] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [summaries, setSummaries] = useState({})
  const [matchEntry, setMatchEntry] = useState([])

  useEffect(() => {

    getPlayers().then((data) => {

      const idsByName = {}

      data.forEach((player) => {
        idsByName[player.Name] = player["Player ID"]
      })

      setPlayerIds(idsByName)
      setPlayers(data)

    })

    getMatchEntry().then((data) => {

      setMatchEntry(data)
      setSummaries(getPlayerSummaries(data))

    })

  }, [])

  // Match Entry keeps a row for every player who ever appeared in a
  // matchup, even one that's since been removed from the Players sheet -
  // so only names still on that sheet are eligible to rank. Substitute
  // players (name tagged "(Sub)") fill in for someone else's match but
  // shouldn't earn a season ranking of their own, so they're excluded
  // from both leaderboards here too.
  const activeNames = new Set(players.map((player) => player.Name))

  const rankablePlayers = Object.entries(summaries)
    .filter(([name]) => activeNames.has(name))
    .filter(([name]) => !/\(sub\)/i.test(name))

  // Rank is computed here from Ranking Factor (AVG Ranking Points)
  // rather than trusting the sheet's own Current Rank column, which is
  // a separate lookup against the old Rankings tab and can drift out
  // of sync with what Match Entry actually calculates.
  const sortedPlayers = rankablePlayers
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.avgRankingPoints - a.avgRankingPoints)

  let rankCounter = 0

  const rankedPlayers = sortedPlayers.map((player) => {

    if (player.eventsPlayed > 0) {
      rankCounter += 1
      return { ...player, computedRank: rankCounter }
    }

    return { ...player, computedRank: null }

  })

  // Movement compares each player's current Ranking Factor rank against
  // where they ranked before the most recently played event. Only players
  // who actually played in that event get a movement value - otherwise
  // someone who sat out could appear to "drop" just because another
  // player's result pushed past them in the standings.
  const playedRows = matchEntry.filter((row) => row.Player && row.Contributions)

  const playedEventIds = [...new Set(playedRows.map((row) => Number(row["Event ID"])))]
    .sort((a, b) => a - b)

  const lastEventId = playedEventIds[playedEventIds.length - 1]
  const previousEventId = playedEventIds[playedEventIds.length - 2]

  const playedLastEvent = new Set(
    playedRows
      .filter((row) => Number(row["Event ID"]) === lastEventId)
      .map((row) => row.Player.trim())
  )

  const previousRanks = previousEventId !== undefined
    ? getRanksThroughEvent(playedRows, previousEventId)
    : {}

  const rankedPlayersWithMovement = rankedPlayers.map((player) => {

    const previousRank = previousRanks[player.name]

    const movement =
      player.computedRank && previousRank !== undefined && playedLastEvent.has(player.name)
        ? previousRank - player.computedRank
        : null

    return { ...player, movement }

  })

  const powerRankedPlayers = rankablePlayers
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.totalPowerScore - a.totalPowerScore)
    .reduce((acc, player) => {

      if (player.eventsPlayed > 0) {
        acc.rankCounter += 1
        acc.players.push({ ...player, computedRank: acc.rankCounter })
      } else {
        acc.players.push({ ...player, computedRank: null })
      }

      return acc

    }, { rankCounter: 0, players: [] }).players

  return (

    <>

    <section className="card">

      <h2>
        Horsewide Leaderboard
      </h2>

      <div className="table-scroll">

      <table className="leaderboard-table horsewide-table">

        <thead>

          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Ranking Factor</th>
            <th>Events Played</th>
            <th>Wins</th>
            <th>Runner-Ups</th>
            <th>Movement</th>
          </tr>

        </thead>

        <tbody>

          {rankedPlayersWithMovement.map((player) => (

            <tr key={player.name}>

              <td>

                {player.computedRank ?? "-"}

              </td>

              <td>

                <div className="leaderboard-player">

                  <img
                    src={`${import.meta.env.BASE_URL}images/players/${playerIds[player.name]}.jpg`}
                    alt={player.name}
                    className="leaderboard-avatar"
                    onError={(e) => {
                      e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
                    }}
                  />

                  {player.name}

                </div>

              </td>

              <td>

                {player.avgRankingPoints}

              </td>

              <td>

                {player.eventsPlayed}

              </td>

              <td>

                {player.wins}

              </td>

              <td>

                {player.runnerUps}

              </td>

              <td>

                {player.movement === null || player.movement === 0 ? (
                  <span className="movement-neutral">—</span>
                ) : player.movement > 0 ? (
                  <span className="movement-up">▲ {player.movement}</span>
                ) : (
                  <span className="movement-down">▼ {Math.abs(player.movement)}</span>
                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      </div>

    </section>

    <section className="card power-points-card">

      <h2>
        Power Points Leaderboard
      </h2>

      <div className="table-scroll">

      <table className="leaderboard-table power-points-table">

        <thead>

          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Power Points</th>
          </tr>

        </thead>

        <tbody>

          {powerRankedPlayers.map((player) => (

            <tr key={player.name}>

              <td>

                {player.computedRank ?? "-"}

              </td>

              <td>

                <div className="leaderboard-player">

                  <img
                    src={`${import.meta.env.BASE_URL}images/players/${playerIds[player.name]}.jpg`}
                    alt={player.name}
                    className="leaderboard-avatar"
                    onError={(e) => {
                      e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
                    }}
                  />

                  {player.name}

                </div>

              </td>

              <td>

                {player.totalPowerScore}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      </div>

    </section>

    </>

  )

}

export default Leaderboard
