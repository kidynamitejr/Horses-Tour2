import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getEvents, getMatchEntry } from "../data/googleSheets"
import { slugify } from "../utils/slugify"
import { MapPinIcon, TrophyIcon, FlagIcon } from "../components/Icons"

const BASE = import.meta.env.BASE_URL
const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

// Official Google Maps embed (free to use on websites) - satellite view.
function mapEmbedUrl(name, address) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${name} golf course, ${address}`)}&t=k&z=15&output=embed`
}

function mapLinkUrl(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`
}

function formatToPar(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return "-"
  if (num === 0) return "E"
  return num > 0 ? `+${num}` : String(num)
}

function CoursePhoto({ course }) {
  const [extIndex, setExtIndex] = useState(0)

  if (extIndex >= COURSE_IMAGE_EXTENSIONS.length) {
    return <div className="crs-photo-fallback"><FlagIcon size={36} /></div>
  }

  return (
    <img
      src={`${BASE}images/courses/${slugify(course)}.${COURSE_IMAGE_EXTENSIONS[extIndex]}`}
      alt={course}
      loading="lazy"
      onError={() => setExtIndex((i) => i + 1)}
    />
  )
}

function CoursesPage() {

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState({})

  useEffect(() => {

    Promise.all([getEvents(), getMatchEntry()])
      .then(([events, matchEntry]) => {

        // Winning team + score per event, from Match Entry.
        const winners = {}
        matchEntry.forEach((row) => {
          if (!row.Player || !row.Contributions || Number(row.Placement) !== 1) return
          const id = row["Event ID"]
          if (!winners[id]) winners[id] = { players: [], score: row["Team Score"] }
          winners[id].players.push(row.Player.trim())
        })

        const byCourse = new Map()

        events
          .filter((e) => e.Course && e["Event Name"])
          .forEach((e) => {
            const name = e.Course.trim()
            if (!byCourse.has(name)) {
              byCourse.set(name, { name, address: (e.Address || "").trim(), events: [] })
            }
            byCourse.get(name).events.push({
              id: e["Event ID"],
              name: e["Event Name"].trim(),
              date: e.Date,
              type: (e["Event Type"] || "").trim(),
              winner: winners[e["Event ID"]] || null,
            })
          })

        setCourses([...byCourse.values()])

      })
      .catch((error) => console.error("Courses Error:", error))
      .finally(() => setLoading(false))

  }, [])

  return (

    <div className="crs">

      <div className="crs-head">
        <span className="crs-eyebrow">Host Courses</span>
        <h2>Where the Tour Plays</h2>
        <p>
          {loading ? "Loading courses..." : `${courses.length} courses across the Baton Rouge area.`} Tap a
          map to explore each layout in satellite view.
        </p>
      </div>

      <div className="crs-list">

        {courses.map((course, index) => {

          const showMap = view[course.name] !== "photo"
          const record = course.events
            .filter((e) => e.winner && !isNaN(parseFloat(e.winner.score)))
            .sort((a, b) => parseFloat(a.winner.score) - parseFloat(b.winner.score))[0]

          return (

            <article className="crs-card" key={course.name}>

              <div className="crs-media">

                <div className="crs-media-toggle" role="tablist" aria-label={`${course.name} view`}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={showMap}
                    className={showMap ? "active" : ""}
                    onClick={() => setView((v) => ({ ...v, [course.name]: "map" }))}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!showMap}
                    className={!showMap ? "active" : ""}
                    onClick={() => setView((v) => ({ ...v, [course.name]: "photo" }))}
                  >
                    Photo
                  </button>
                </div>

                {showMap && course.address ? (
                  <iframe
                    title={`${course.name} map`}
                    src={mapEmbedUrl(course.name, course.address)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <CoursePhoto course={course.name} />
                )}

              </div>

              <div className="crs-body">

                <span className="crs-num">{String(index + 1).padStart(2, "0")}</span>

                <h3>{course.name}</h3>

                {course.address && (
                  <a className="crs-address" href={mapLinkUrl(course.name, course.address)} target="_blank" rel="noopener noreferrer">
                    <MapPinIcon size={15} /> {course.address} ↗
                  </a>
                )}

                <div className="crs-stats">
                  <div>
                    <b>{course.events.length}</b>
                    <span>Event{course.events.length === 1 ? "" : "s"}</span>
                  </div>
                  <div>
                    <b>{record ? formatToPar(record.winner.score) : "-"}</b>
                    <span>Course record</span>
                  </div>
                </div>

                <ul className="crs-events">
                  {course.events.map((e) => (
                    <li key={e.id}>
                      <div>
                        <strong>{e.name}</strong>
                        <span>
                          {e.date}
                          {e.type && e.type.toLowerCase() !== "regular" && <em> · ★ {e.type}</em>}
                        </span>
                      </div>
                      {e.winner ? (
                        <span className="crs-winner"><TrophyIcon size={14} /> {e.winner.players.join(" & ")} ({formatToPar(e.winner.score)})</span>
                      ) : (
                        <span className="crs-upcoming">Upcoming</span>
                      )}
                    </li>
                  ))}
                </ul>

                <Link to="/course-history" className="crs-link">Hole-by-hole history →</Link>

              </div>

            </article>

          )

        })}

      </div>

    </div>

  )

}

export default CoursesPage
