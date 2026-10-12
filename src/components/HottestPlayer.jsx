import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getPlayers, getSchedule, getMatchEntry } from "../data/googleSheets"

function HottestPlayer() {

  const [hottest, setHottest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadHottestPlayer() {

      try {

        const [players, schedule, matchEntry] = await Promise.all([
          getPlayers(),
          getSchedule(),
          getMatchEntry(),
        ])

        // A played row is one with Contributions filled in - future/
        // unplayed event rows in Match Entry are dragged-down formula
        // rows with blanks there.
        const played = matchEntry.filter((row) => row.Player && row.Contributions)

        if (played.length === 0) {
          setHottest(null)
          return
        }

        const latestEventId = Math.max(
          ...played.map((row) => Number(row["Event ID"]))
        )

        const latestEventRows = played.filter(
          (row) => Number(row["Event ID"]) === latestEventId
        )

        const topRow = latestEventRows.reduce((best, row) =>
          (parseFloat(row["Match Ranking Points"]) || 0) >
          (parseFloat(best["Match Ranking Points"]) || 0)
            ? row
            : best
        )

        const player = players.find(
          (p) =>
            p.Name.trim().toLowerCase() ===
            topRow.Player.trim().toLowerCase()
        )

        const event = schedule.find(
          (e) => e["Event ID"] === String(latestEventId)
        )

        setHottest({
          player,
          eventName: event ? event["Event Name"] : `Event ${latestEventId}`,
          pointsEarned: (parseFloat(topRow["Match Ranking Points"]) || 0).toFixed(2),
        })

      } catch (error) {

        console.error("Hottest Player Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadHottestPlayer()

  }, [])

  if (loading || !hottest || !hottest.player) {
    return null
  }

  const { player, eventName, pointsEarned } = hottest

  return (

    <Link
      to={`/player-profile/${player["Player ID"]}`}
      className="featured-player card"
    >

      <h2>Featured Player</h2>

      <div className="featured-player-content">

        <div className="featured-player-avatar-ring">

          <img
            src={`${import.meta.env.BASE_URL}images/players/${player["Player ID"]}.jpg`}
            alt={player.Name}
            className="featured-player-image"
            onError={(e) => {
              e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
            }}
          />

        </div>

        <div>

          <h3>{player.Name}</h3>

          <p>
            Top Scorer at {eventName}
          </p>

          <span className="featured-player-points-pill">
            {pointsEarned} pts earned
          </span>

          <span className="featured-player-cta">
            View Full Profile →
          </span>

        </div>

      </div>

    </Link>

  )

}

export default HottestPlayer
