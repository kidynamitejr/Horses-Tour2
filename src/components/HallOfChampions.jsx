import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getSchedule, getMatchEntry, getPlayers, getEvents } from "../data/googleSheets"

function formatOverPar(value) {
  if (value === "" || value === null || value === undefined) return value
  const num = Number(value)
  if (isNaN(num)) return value
  return num >= 0 ? `+${value}` : value
}

// Schedule dates are "M/D/YY" (e.g. "8/23/26") - pulled apart by hand
// instead of trusting `new Date(...)`, since browsers don't agree on how
// a 2-digit year like "26" should be expanded.
function getEventYear(dateStr) {
  if (!dateStr) return ""
  const parts = dateStr.split("/")
  if (parts.length !== 3) return ""
  let year = parts[2].trim()
  if (year.length === 2) year = `20${year}`
  return year
}

function HallOfChampions() {

  const [champions, setChampions] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadChampions() {

      try {

        const [schedule, matchEntry, players, events] = await Promise.all([
          getSchedule(),
          getMatchEntry(),
          getPlayers(),
          getEvents(),
        ])

        const idsByName = {}

        players.forEach((p) => { idsByName[p.Name] = p["Player ID"] })

        setPlayerIds(idsByName)

        const eventById = {}

        schedule.forEach((e) => { eventById[e["Event ID"]] = e })

        const eventsTabById = {}

        events.forEach((e) => { eventsTabById[e["Event ID"]] = e })

        const majorWinsEvents = new Set()

        events.forEach((e) => {
          const type = (e["Event Type"] || "").trim().toLowerCase()
          if (type === "major" || type === "championship") {
            majorWinsEvents.add(e["Event ID"])
          }
        })

        const winningRows = matchEntry.filter(
          (row) => row.Player && row.Contributions && Number(row.Placement) === 1
        )

        const byEvent = {}

        winningRows.forEach((row) => {

          const eventId = row["Event ID"]

          if (!byEvent[eventId]) {
            byEvent[eventId] = {
              eventId,
              players: [],
              teamScore: row["Team Score"],
            }
          }

          byEvent[eventId].players.push(row.Player.trim())

        })

        const list = Object.values(byEvent)
          .map((c) => {
            const event = eventById[c.eventId]
            return {
              ...c,
              eventName: event ? event["Event Name"].trim() : `Event ${c.eventId}`,
              date: event ? event.Date : "",
              year: event ? getEventYear(event.Date) : "",
              // A photo the tour owner pastes a link to in the Events
              // tab's "Winner Picture" column - same pattern as the
              // News tab's Image column - not a stock course photo.
              image: eventsTabById[c.eventId]?.["Winner Picture"] || "",
              isMajor: majorWinsEvents.has(c.eventId),
            }
          })
          .sort((a, b) => Number(b.eventId) - Number(a.eventId))

        setChampions(list)

      } catch (error) {

        console.error("Hall of Champions Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadChampions()

  }, [])

  return (

    <section className="card">

      <h2>Hall of Champions</h2>

      {loading && <p>Loading champions...</p>}

      {!loading && champions.length === 0 && (
        <p>No champions crowned yet.</p>
      )}

      <div className="champion-grid">

        {champions.map((c) => (

          <div className={`champion-card${c.isMajor ? " champion-card-major" : ""}`} key={c.eventId}>

            <div className="champion-card-header">

              <p className="champion-card-eyebrow">{c.date}</p>

              <h3 className="champion-card-event">
                {c.year} {c.eventName}
              </h3>

              {c.isMajor && (
                <span className="champion-card-major-tag">★ Major</span>
              )}

            </div>

            <div className="champion-card-photo-wrap">

              {c.image ? (
                <img
                  src={c.image}
                  alt={c.eventName}
                  className="champion-card-photo"
                />
              ) : (
                <div className="champion-card-photo-fallback" />
              )}

              <div className="champion-card-photo-overlay">

                {c.players.map((name, i) => (

                  <span className="champion-card-player-wrap" key={name}>

                    <Link
                      to={`/player-profile/${playerIds[name]}`}
                      className="champion-card-player"
                    >
                      {name}
                    </Link>

                    {i < c.players.length - 1 && (
                      <span className="champion-card-and">&amp;</span>
                    )}

                  </span>

                ))}

              </div>

            </div>

            <p className="champion-card-score">
              Team Score: {formatOverPar(c.teamScore)}
            </p>

          </div>

        ))}

      </div>

    </section>

  )

}

export default HallOfChampions
