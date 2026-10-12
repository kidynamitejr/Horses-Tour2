import { useEffect, useState } from "react"
import { getMatchEntry, getSchedule, getPlayers } from "../data/googleSheets"

function formatOverPar(value) {
  if (value === "" || value === null || value === undefined) return value
  const num = Number(value)
  if (isNaN(num)) return value
  return num >= 0 ? `+${value}` : value
}

function LastMatchResults() {

  const [eventName, setEventName] = useState("")
  const [rows, setRows] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadResults() {

      try {

        const [matchEntry, schedule, players] = await Promise.all([
          getMatchEntry(),
          getSchedule(),
          getPlayers(),
        ])

        const idsByName = {}

        players.forEach((player) => {
          idsByName[player.Name] = player["Player ID"]
        })

        setPlayerIds(idsByName)

        const played = matchEntry.filter((row) => row.Player && row.Contributions)

        if (played.length === 0) {
          setRows([])
          setLoading(false)
          return
        }

        const eventIds = [
          ...new Set(played.map((row) => Number(row["Event ID"]))),
        ].sort((a, b) => b - a)

        const lastEventId = eventIds[0]
        const previousEventId = eventIds[1]

        const previousPlacementByPlayer = {}

        if (previousEventId !== undefined) {
          played
            .filter((row) => Number(row["Event ID"]) === previousEventId)
            .forEach((row) => {
              previousPlacementByPlayer[row.Player.trim()] = Number(row.Placement)
            })
        }

        const results = played
          .filter((row) => Number(row["Event ID"]) === lastEventId)
          .map((row) => {

            const placement = Number(row.Placement)
            const prevPlacement = previousPlacementByPlayer[row.Player.trim()]

            const delta =
              prevPlacement !== undefined && !isNaN(placement)
                ? prevPlacement - placement
                : null

            return {
              player: row.Player,
              matchPoints: parseFloat(row["Match Ranking Points"]) || 0,
              contributions: row.Contributions,
              contributionPercent: row["Contribution %"],
              teamScore: row["Team Score"],
              placement: row.Placement,
              delta,
            }

          })
          // When players tie on Match Points (most commonly everyone at 0
          // in last place), break the tie by whoever contributed more.
          .sort((a, b) =>
            b.matchPoints - a.matchPoints ||
            (parseFloat(b.contributions) || 0) - (parseFloat(a.contributions) || 0)
          )

        const event = schedule.find(
          (e) => e["Event ID"] === String(lastEventId)
        )

        setEventName(event ? event["Event Name"] : `Event ${lastEventId}`)
        setRows(results)

      } catch (error) {

        console.error("Last Match Results Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadResults()

  }, [])

  if (loading) {
    return (
      <section className="card">
        <h2>Last Match Results</h2>
        <p>Loading...</p>
      </section>
    )
  }

  return (

    <section className="card">

      <h2>
        {eventName ? `${eventName} Results` : "Last Match Results"}
      </h2>

      {rows.length === 0 && (
        <p>No matches played yet.</p>
      )}

      {rows.length > 0 && (

        <div className="table-scroll">

          <table className="leaderboard-table last-match-table">

            <thead>
              <tr>
                <th>Placement</th>
                <th>Player</th>
                <th>Match Points</th>
                <th>Contributions</th>
                <th>Contribution %</th>
                <th>Team Score</th>
                <th>Team Placement</th>
                <th>Movement</th>
              </tr>
            </thead>

            <tbody>

              {rows.map((row, index) => (

                <tr key={row.player}>

                  <td>{index + 1}</td>

                  <td>

                    <div className="leaderboard-player">

                      <img
                        src={`${import.meta.env.BASE_URL}images/players/${playerIds[row.player]}.jpg`}
                        alt={row.player}
                        className="leaderboard-avatar"
                        onError={(e) => {
                          e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
                        }}
                      />

                      {row.player}

                    </div>

                  </td>

                  <td>{row.matchPoints.toFixed(2)}</td>
                  <td>{row.contributions}</td>
                  <td>{row.contributionPercent}</td>
                  <td>{formatOverPar(row.teamScore)}</td>
                  <td>{row.placement}</td>

                  <td>
                    {row.delta === null || row.delta === 0 ? (
                      <span className="movement-neutral">—</span>
                    ) : row.delta > 0 ? (
                      <span className="movement-up">▲ {row.delta}</span>
                    ) : (
                      <span className="movement-down">▼ {Math.abs(row.delta)}</span>
                    )}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </section>

  )

}

export default LastMatchResults
