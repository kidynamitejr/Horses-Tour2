import { useEffect, useState } from "react"
import { getEvents, getPlayers, getSchedule, getMatchEntry } from "../data/googleSheets"
import { completedEventIds } from "../utils/eventStatus"
import MatchResultsView from "./MatchResultsView"

function LastMatchFeature() {

  const [playerIds, setPlayerIds] = useState({})
  const [schedule, setSchedule] = useState([])
  const [matchEntry, setMatchEntry] = useState([])
  const [events, setEvents] = useState(null)

  useEffect(() => {

    getPlayers().then((data) => {

      const idsByName = {}

      data.forEach((player) => {
        idsByName[player.Name] = player["Player ID"]
      })

      setPlayerIds(idsByName)

    })

    getSchedule().then(setSchedule)
    getMatchEntry().then(setMatchEntry)
    getEvents().then(setEvents).catch(() => setEvents([]))

  }, [])

  // Only finished events (with a Winner) - an event whose round is still
  // being submitted stays out until every team is in.
  const finished = events && events.length ? completedEventIds(events) : null
  const playedRows = matchEntry.filter((row) =>
    row.Player && row.Contributions && (!finished || finished.has((row["Event ID"] || "").trim())))

  const lastEventId = playedRows.length > 0
    ? Math.max(...playedRows.map((row) => Number(row["Event ID"])))
    : undefined

  if (lastEventId === undefined) {
    return (
      <section className="next-event-feature next-event-empty">
        <h2>No Matches Played Yet</h2>
      </section>
    )
  }

  return (
    <MatchResultsView
      eventId={lastEventId}
      matchEntry={matchEntry}
      schedule={schedule}
      playerIds={playerIds}
      eyebrow="Last Match"
    />
  )

}

export default LastMatchFeature
