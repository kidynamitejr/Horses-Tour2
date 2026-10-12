import { useEffect, useState } from "react"
import { getContributions, getSchedule } from "../data/googleSheets"

function PointsCalculator() {

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadData() {

      try {

        const [contributions, schedule] = await Promise.all([
          getContributions(),
          getSchedule(),
        ])

        const scheduleById = {}

        schedule.forEach((event) => {
          scheduleById[event["Event ID"]] = event
        })

        const eventIds = []

        contributions.forEach((row) => {
          if (row["Event ID"] && !eventIds.includes(row["Event ID"])) {
            eventIds.push(row["Event ID"])
          }
        })

        const grouped = eventIds
          .map((eventId) => {

            const event = scheduleById[eventId]

            const rows = contributions
              .filter((row) => row["Event ID"] === eventId)
              .sort(
                (a, b) =>
                  parseFloat(b["Match Points"]) - parseFloat(a["Match Points"])
              )

            return {
              eventId,
              eventName: event ? event["Event Name"] : `Event ${eventId}`,
              date: event ? event.Date : "",
              rows,
            }

          })
          .sort((a, b) => Number(b.eventId) - Number(a.eventId))

        setEvents(grouped)

      } catch (error) {

        console.error("Points Calculator Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadData()

  }, [])

  return (

    <section className="card">

      <h2>Points Calculator</h2>

      <p>
        Final points earned per player for each event, calculated in the
        Google Sheet: placement points × contribution % × rank multiplier.
      </p>

      {loading && (
        <p>Loading...</p>
      )}

      {!loading && events.length === 0 && (
        <p>No contribution data yet.</p>
      )}

      {!loading && events.map((event) => (

        <div key={event.eventId} className="calc-event">

          <h3>
            {event.eventName}
            {event.date && ` — ${event.date}`}
          </h3>

          <div className="table-scroll">

            <table className="calc-table">

              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Contribution</th>
                  <th>Points Earned</th>
                  <th>Rank</th>
                  <th>Multiplier</th>
                  <th>Final Points</th>
                </tr>
              </thead>

              <tbody>

                {event.rows.map((row, index) => (

                  <tr key={index}>
                    <td>{row.Player}</td>
                    <td>{row.Team}</td>
                    <td>{row["Contribution %"]}</td>
                    <td>{row["Points Earned"]}</td>
                    <td>
                      {row["Player's current rank"]
                        ? `#${row["Player's current rank"]}`
                        : "New"}
                    </td>
                    <td>{row["Multiplyer"]}x</td>
                    <td>
                      <strong>{row["Match Points"]}</strong>
                    </td>
                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      ))}

    </section>

  )

}

export default PointsCalculator
