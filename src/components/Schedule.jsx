import { useEffect, useState } from "react"
import { getSchedule, getMatchEntry, getEvents } from "../data/googleSheets"


function Schedule() {

  const [events, setEvents] = useState([])
  const [winnersByEventId, setWinnersByEventId] = useState({})
  const [teeTimesByEventId, setTeeTimesByEventId] = useState({})


  useEffect(() => {

    async function loadSchedule() {

      const [data, matchEntry, eventDetails] = await Promise.all([
        getSchedule(),
        getMatchEntry(),
        getEvents(),
      ])

      setEvents(data)

      // Tee times are kept on the Events tab's "Tee Time" column.
      const teeTimes = {}

      eventDetails.forEach((row) => {
        teeTimes[row["Event ID"]] = row["Tee Time"]?.trim()
      })

      setTeeTimesByEventId(teeTimes)

      // The Winner column is computed live from Match Entry (whichever
      // team has Placement 1) instead of the sheet's own Winner cell,
      // since that cell is easy to forget updating after an event.
      const winningTeams = {}

      matchEntry.forEach((row) => {

        if (!row.Player || Number(row.Placement) !== 1) return

        const eventId = row["Event ID"]

        if (!winningTeams[eventId]) winningTeams[eventId] = []

        winningTeams[eventId].push(row.Player.trim())

      })

      const winners = {}

      Object.entries(winningTeams).forEach(([eventId, players]) => {
        winners[eventId] = players.join(" / ")
      })

      setWinnersByEventId(winners)

    }

    loadSchedule()

  }, [])



  return (

    <section className="card">


      <h2>
        Tour Schedule
      </h2>


      <div className="table-scroll">

      <table className="leaderboard-table">


        <thead>

          <tr>

            <th>Event</th>
            <th>Date</th>
            <th>Course</th>
            <th>Classification</th>
            <th>Winner</th>
            <th>Tee Times</th>

          </tr>

        </thead>


        <tbody>


          {events.map((event, index) => (

            <tr key={index}>


              <td className="schedule-event-name">
                {event["Event Name"]}
              </td>


              <td>
                {event.Date}
              </td>


              <td>
                {event.Course}
              </td>


              <td>
                {event.Status && (() => {

                  const statusText = event.Status.trim()
                  const statusLower = statusText.toLowerCase()
                  // Major and Championship both get special treatment,
                  // but with their own distinct colors.
                  const isMajor = statusLower === "major"
                  const isChampionship = statusLower === "championship"
                  const isSpecial = isMajor || isChampionship

                  const badgeClass = isMajor
                    ? "status-major"
                    : isChampionship
                      ? "status-championship"
                      : statusLower === "played"
                        ? "status-played"
                        : statusLower === "regular"
                          ? "status-regular"
                          : "status-planned"

                  return (
                    <span className={`status-badge ${badgeClass}`}>
                      {isSpecial && <span className="status-major-star">★</span>}
                      {statusText}
                    </span>
                  )

                })()}
              </td>


              <td>
                {(() => {

                  const winner = winnersByEventId[event["Event ID"]]

                  return (
                    <span className={`schedule-winner${winner ? "" : " schedule-winner-pending"}`}>
                      {winner || "TBD"}
                    </span>
                  )

                })()}
              </td>


              <td>
                {teeTimesByEventId[event["Event ID"]] || "TBD"}
              </td>


            </tr>

          ))}


        </tbody>


      </table>

      </div>


    </section>

  )

}


export default Schedule