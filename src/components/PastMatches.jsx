import { useEffect, useState } from "react"
import { getSchedule, getMatchEntry, getPlayers } from "../data/googleSheets"
import { slugify } from "../utils/slugify"
import MatchResultsView from "./MatchResultsView"

const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

function CourseImage({ course }) {

  const [extIndex, setExtIndex] = useState(0)

  if (extIndex >= COURSE_IMAGE_EXTENSIONS.length) {
    return null
  }

  const src = `${import.meta.env.BASE_URL}images/courses/${slugify(course)}.${COURSE_IMAGE_EXTENSIONS[extIndex]}`

  return (
    <img
      src={src}
      alt=""
      className="match-card-bg-img"
      onError={() => setExtIndex((i) => i + 1)}
    />
  )

}

function PastMatches() {

  const [matches, setMatches] = useState([])
  const [schedule, setSchedule] = useState([])
  const [matchEntry, setMatchEntry] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedEventId, setExpandedEventId] = useState(null)

  useEffect(() => {

    async function loadMatches() {

      try {

        const [scheduleData, matchEntryData, players] = await Promise.all([
          getSchedule(),
          getMatchEntry(),
          getPlayers(),
        ])

        setSchedule(scheduleData)
        setMatchEntry(matchEntryData)

        const idsByName = {}

        players.forEach((player) => {
          idsByName[player.Name] = player["Player ID"]
        })

        setPlayerIds(idsByName)

        // An event is "past" once it has actual results in Match Entry,
        // rather than trusting the Schedule tab's own Status column -
        // that column now holds the event type ("Regular"/"Major")
        // instead of "Played"/"Planned", so it can't tell us that anymore.
        const playedEventIds = new Set(
          matchEntryData
            .filter((row) => row.Player && row.Contributions)
            .map((row) => row["Event ID"])
        )

        const pastEvents = scheduleData
          .filter((event) => playedEventIds.has(event["Event ID"]))
          .sort((a, b) => new Date(b.Date) - new Date(a.Date))

        setMatches(pastEvents)

      } catch (error) {

        console.error("Past Matches Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadMatches()

  }, [])

  if (loading) {
    return (
      <section className="card">
        <h2>Past Matches</h2>
        <p>Loading past matches...</p>
      </section>
    )
  }

  return (

    <section className="card">

      <h2>
        Past Matches
      </h2>

      {matches.length === 0 && (
        <p>No past matches yet.</p>
      )}

      <div className="match-grid">

        {matches.map((match) => {

          const eventId = match["Event ID"]

          // Clicking a match expands its photo into the full results
          // view (teams, click-through recaps) right in place, instead
          // of navigating away or popping up a separate screen.
          if (expandedEventId === eventId) {
            return (
              <MatchResultsView
                key={eventId}
                eventId={eventId}
                matchEntry={matchEntry}
                schedule={schedule}
                playerIds={playerIds}
                eyebrow="Past Match"
                onCollapse={() => setExpandedEventId(null)}
              />
            )
          }

          return (

            <div
              className="match-card"
              key={eventId}
              onClick={() => setExpandedEventId(eventId)}
            >

              <CourseImage course={match.Course} />

              <div className="match-card-front">
                <h3>{match["Event Name"]}</h3>
                <p>{match.Date}</p>
              </div>

            </div>

          )

        })}

      </div>

    </section>

  )

}


export default PastMatches
