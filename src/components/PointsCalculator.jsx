import { useEffect, useState } from "react"
import { getMatchEntry, getSchedule } from "../data/googleSheets"
import { getPlayedMatchEntryRows } from "../utils/matchEntry"
import { ordinal } from "../utils/ordinal"

// Reads Match Entry (like the rest of the site) instead of the old
// Contributions tab, which stopped being updated after the first two events.
function formatPoints(value) {
  const num = parseFloat(value)
  return isNaN(num) ? "-" : num.toFixed(2)
}

function PointsCalculator() {

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadData() {

      try {

        const [matchEntry, schedule] = await Promise.all([
          getMatchEntry(),
          getSchedule(),
        ])

        const scheduleById = {}

        schedule.forEach((event) => {
          scheduleById[event["Event ID"]] = event
        })

        const playedRows = getPlayedMatchEntryRows(matchEntry)

        const eventIds = []

        playedRows.forEach((row) => {
          if (row["Event ID"] && !eventIds.includes(row["Event ID"])) {
            eventIds.push(row["Event ID"])
          }
        })

        const grouped = eventIds
          .map((eventId) => {

            const event = scheduleById[eventId]

            const rows = playedRows
              .filter((row) => row["Event ID"] === eventId)
              .sort(
                (a, b) =>
                  parseFloat(b["Match Ranking Points"]) - parseFloat(a["Match Ranking Points"])
              )

            return {
              eventId,
              eventName: event ? event["Event Name"].trim() : `Event ${eventId}`,
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
        <p>No match results yet.</p>
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
                  <th>Finish</th>
                  <th>Contribution</th>
                  <th>Placement Points</th>
                  <th>Multiplier</th>
                  <th>Final Points</th>
                </tr>
              </thead>

              <tbody>

                {event.rows.map((row, index) => (

                  <tr key={index}>
                    <td>{row.Player}</td>
                    <td>{row.Team}</td>
                    <td>{row.Placement ? ordinal(Number(row.Placement)) : "-"}</td>
                    <td>{row["Contribution %"]}</td>
                    <td>{row["Power Score Earned"]}</td>
                    <td>{row.Multiplier}x</td>
                    <td>
                      <strong>{formatPoints(row["Match Ranking Points"])}</strong>
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
