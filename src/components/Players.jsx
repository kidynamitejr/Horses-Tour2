import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getPlayers, getMatchEntry, getEvents } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { getMajorWins } from "../utils/majors"

function Players() {

  const [players, setPlayers] = useState([])
  const [summaries, setSummaries] = useState({})
  const [majorWins, setMajorWins] = useState({})

  useEffect(() => {

    getPlayers().then(data => {

      setPlayers(data)

    })

    getMatchEntry().then((data) => {

      setSummaries(getPlayerSummaries(data))

    })

    getEvents().then((events) => {

      setMajorWins(getMajorWins(events))

    })

  }, [])

  return (

    <section className="card">

      <h2>
        Players
      </h2>

      <div className="player-grid">

        {players.filter((player) => !/\bsub\b/i.test(player.Name)).map((player) => {

          const summary = summaries[player.Name.trim()]
          const majors = majorWins[player.Name.trim()] || 0

          return (

            <Link
              key={player["Player ID"]}
              to={`/player-profile/${player["Player ID"]}`}
              className="player-link"
            >

              <div className="player-card">

                <img
                  src={`${import.meta.env.BASE_URL}images/players/${player["Player ID"]}.jpg`}
                  alt={player.Name}
                  className="player-headshot"
                  onError={(e) => {
                    e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
                  }}
                />

                <h3>
                  {player.Name}
                </h3>

                <div className="player-card-stats">

                  <div className="player-card-stat-row player-card-stat-majors">
                    <span className="player-card-stat-label">Major Wins</span>
                    <span className="player-card-stat-value">{majors}</span>
                  </div>

                  <div className="player-card-stat-row">
                    <span className="player-card-stat-label">Wins</span>
                    <span className="player-card-stat-value">{summary ? summary.wins : 0}</span>
                  </div>

                  <div className="player-card-stat-row">
                    <span className="player-card-stat-label">Runner Ups</span>
                    <span className="player-card-stat-value">{summary ? summary.runnerUps : 0}</span>
                  </div>

                </div>

              </div>

            </Link>

          )

        })}

      </div>

    </section>

  )

}

export default Players