import { useEffect, useState } from "react"

import {
  getPlayers,
  getEvents,
  getMatchEntry,
} from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"

function Dashboard() {
  const [players, setPlayers] = useState([])
  const [events, setEvents] = useState([])
  const [leader, setLeader] = useState(null)

  useEffect(() => {
    getPlayers().then(setPlayers)
    getEvents().then(setEvents)

    getMatchEntry().then((data) => {

      const summaries = getPlayerSummaries(data)

      // Find the player with the most Power Points - this is an
      // independent season-long tracker, unrelated to Rank/Ranking Points.
      const topPlayer = Object.entries(summaries).reduce((best, [name, s]) => {
        if (!best || s.totalPowerScore > best.totalPowerScore) return { name, ...s }
        return best
      }, null)

      setLeader(topPlayer)

    })
  }, [])

  return (
    <section className="dashboard-grid">

      <div className="dashboard-card leader">

        <h2>Power Points Leader</h2>

        {leader ? (
          <>
            <h3>{leader.name}</h3>
            <p>{leader.totalPowerScore} Points</p>
          </>
        ) : (
          <>
            <h3>Loading...</h3>
            <p>Please wait...</p>
          </>
        )}

      </div>

      <div className="dashboard-card players">

        <h2>Players</h2>

        <h3>{players.filter((p) => !/\(sub\)/i.test(p.Name)).length}</h3>

        <p>Registered Members</p>

      </div>

      <div className="dashboard-card events">

        <h2>Events</h2>

        <h3>{events.length}</h3>

        <p>2026 Season Events</p>

        <p className="dashboard-card-subtext">
          {events.filter((e) => e.Status && e.Status.trim().toLowerCase() === "planned").length} Remaining
        </p>

      </div>

    </section>
  )
}

export default Dashboard
