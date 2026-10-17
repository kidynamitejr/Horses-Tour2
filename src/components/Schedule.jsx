import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getEvents, getMatchEntry, getPlayers } from "../data/googleSheets"
import { COURSE_LAYOUTS, findCourseLayout } from "../siteConfig"
import { slugify } from "../utils/slugify"
import { formatCurrency } from "../utils/winnings"
import { CalendarIcon, FlagIcon, MapPinIcon, TrophyIcon } from "./Icons"

const BASE = import.meta.env.BASE_URL
const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// "M/D/YY" - parsed by hand since browsers disagree on 2-digit years.
function parseDate(text) {
  const parts = (text || "").split("/").map((p) => p.trim())
  if (parts.length !== 3) return null
  const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2])
  const date = new Date(year, Number(parts[0]) - 1, Number(parts[1]))
  return isNaN(date) ? null : date
}

function money(value) {
  const num = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function formatToPar(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return ""
  if (num === 0) return "E"
  return num > 0 ? `+${num}` : String(num)
}

function CoursePhoto({ course }) {
  const [extIndex, setExtIndex] = useState(0)

  if (!course || extIndex >= COURSE_IMAGE_EXTENSIONS.length) {
    return <div className="sch-photo-fallback"><FlagIcon size={28} /></div>
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

function Schedule() {

  const [events, setEvents] = useState([])
  const [winnersByEventId, setWinnersByEventId] = useState({})
  const [playerIds, setPlayerIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {

    async function loadSchedule() {

      try {

        const [eventRows, matchEntry, players] = await Promise.all([
          getEvents(),
          getMatchEntry(),
          getPlayers(),
        ])

        const ids = {}
        players.forEach((p) => { ids[(p.Name || "").trim()] = p["Player ID"] })
        setPlayerIds(ids)

        // The winners come from Match Entry (whichever team has Placement
        // 1) instead of the sheet's own Winner cell, since that cell is
        // easy to forget updating after an event.
        const winners = {}

        matchEntry.forEach((row) => {

          if (!row.Player || !row.Contributions || Number(row.Placement) !== 1) return

          const eventId = row["Event ID"]

          if (!winners[eventId]) winners[eventId] = { players: [], teamScore: row["Team Score"], totalTeams: Number(row["Total Teams"]) || null }

          winners[eventId].players.push(row.Player.trim())

        })

        setWinnersByEventId(winners)
        setEvents(eventRows.filter((e) => e["Event Name"]))

      } catch (error) {

        console.error("Schedule Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadSchedule()

  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const winningsKey = events[0] ? Object.keys(events[0]).find((k) => /winnings/i.test(k)) : null

  const list = events
    .map((e) => {
      const date = parseDate(e.Date)
      const type = (e["Event Type"] || "Regular").trim()
      const winner = winnersByEventId[e["Event ID"]]
      const complete = Boolean(winner) || (date ? date < today : false)
      return {
        id: e["Event ID"],
        name: e["Event Name"].trim(),
        date,
        dateText: e.Date,
        course: (e.Course || "").trim(),
        address: (e.Address || "").trim(),
        teeTime: (e["Tee Time"] || "").trim(),
        type,
        isMajor: type.toLowerCase() === "major",
        isChampionship: type.toLowerCase() === "championship",
        buyIn: money(e["Buy in"]),
        payout: winningsKey ? money(e[winningsKey]) : 0,
        players: Number(e["Player Count"]) || null,
        winner,
        complete,
        daysAway: date ? Math.round((date - today) / 86400000) : null,
      }
    })
    .sort((a, b) => (a.date && b.date ? a.date - b.date : Number(a.id) - Number(b.id)))

  const nextEvent = list.find((e) => !e.complete)
  const completedCount = list.filter((e) => e.complete).length
  const majorsCount = list.filter((e) => e.isMajor || e.isChampionship).length
  const totalPurse = list.reduce((sum, e) => sum + (e.winner ? e.payout * e.winner.players.length : 0), 0)
  const seasonYear = list.find((e) => e.date)?.date.getFullYear() ?? new Date().getFullYear()

  const shown = list.filter((e) =>
    filter === "all" ? true : filter === "upcoming" ? !e.complete : e.complete
  )

  return (

    <div className="sch">

      <section className="sch-hero">
        <div className="sch-hero-main">
          <span className="sch-eyebrow">{seasonYear} Season</span>
          <h2>Tour Schedule</h2>
          <p>
            {list.length} events across {new Set(list.map((e) => e.course)).size} host courses
            {list.length > 0 && `, ending with ${/^the\s/i.test(list[list.length - 1].name) ? "" : "the "}${list[list.length - 1].name}`}.
          </p>

          <div className="sch-progress" aria-label={`${completedCount} of ${list.length} events complete`}>
            <div className="sch-progress-bar">
              <span style={{ width: `${list.length ? (completedCount / list.length) * 100 : 0}%` }} />
            </div>
            <span>{completedCount} of {list.length} complete</span>
          </div>
        </div>

        <dl className="sch-hero-stats">
          <div>
            <dt><CalendarIcon size={16} /> Events</dt>
            <dd>{loading ? "–" : list.length}</dd>
          </div>
          <div>
            <dt><TrophyIcon size={16} /> Majors</dt>
            <dd>{loading ? "–" : majorsCount}</dd>
          </div>
          <div>
            <dt><FlagIcon size={16} /> Next Event</dt>
            <dd>
              {!nextEvent
                ? "Season over"
                : nextEvent.daysAway === 0
                  ? "Today"
                  : nextEvent.daysAway === 1
                    ? "Tomorrow"
                    : `${nextEvent.daysAway} days`}
            </dd>
          </div>
          <div>
            <dt>$ Paid Out</dt>
            <dd>{loading ? "–" : formatCurrency(totalPurse)}</dd>
          </div>
        </dl>
      </section>

      <div className="sch-filters" role="tablist" aria-label="Filter events">
        {[
          ["all", "All Events", list.length],
          ["upcoming", "Upcoming", list.length - completedCount],
          ["completed", "Completed", completedCount],
        ].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>

      {loading && <p className="sch-empty">Loading schedule...</p>}

      <ol className="sch-list">

        {shown.map((e) => {

          const isNext = nextEvent && e.id === nextEvent.id

          return (

            <li
              key={e.id}
              className={`sch-event${e.complete ? " is-complete" : ""}${isNext ? " is-next" : ""}${e.isMajor ? " is-major" : ""}${e.isChampionship ? " is-championship" : ""}`}
            >

              <div className="sch-date">
                {e.date ? (
                  <>
                    <span>{MONTHS[e.date.getMonth()]}</span>
                    <b>{e.date.getDate()}</b>
                    <small>{WEEKDAYS[e.date.getDay()]}</small>
                  </>
                ) : (
                  <b>TBD</b>
                )}
              </div>

              <div className="sch-photo">
                <CoursePhoto course={e.course} />
                {isNext && <span className="sch-ribbon">Up Next</span>}
              </div>

              <div className="sch-info">
                <div className="sch-tags">
                  <span className={`sch-type${e.isMajor ? " is-major" : ""}${e.isChampionship ? " is-championship" : ""}`}>
                    {(e.isMajor || e.isChampionship) && "★ "}{e.type}
                  </span>
                  <span className={`sch-status${e.complete ? " is-complete" : ""}`}>
                    {e.complete ? "Final" : "Upcoming"}
                  </span>
                </div>

                <h3>{e.name}</h3>

                <ul className="sch-meta">
                  <li><MapPinIcon size={14} /> {e.course}</li>
                  {e.teeTime && e.teeTime !== "TBD" && <li><CalendarIcon size={14} /> {e.teeTime} tee time</li>}
                  {e.buyIn > 0 && <li>${e.buyIn} buy-in</li>}
                </ul>

                {e.address && (
                  <a
                    className="sch-map"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {e.address} ↗
                  </a>
                )}

                {findCourseLayout(e.course) && (
                  <a
                    className="sch-layout-link"
                    href={findCourseLayout(e.course).pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FlagIcon size={13} /> Course layout (PDF)
                  </a>
                )}
              </div>

              <div className="sch-result">
                {e.winner ? (
                  <>
                    <span className="sch-result-label"><TrophyIcon size={14} /> Champions</span>
                    <div className="sch-winners">
                      {e.winner.players.map((name) => (
                        <Link key={name} to={`/player-profile/${playerIds[name]}`} className="sch-winner">
                          <img
                            src={`${BASE}images/players/${playerIds[name] || "default"}.jpg`}
                            alt=""
                            onError={(ev) => {
                              ev.target.src = `${BASE}images/players/default.jpg`
                            }}
                          />
                          <span>{name}</span>
                        </Link>
                      ))}
                    </div>
                    <div className="sch-result-foot">
                      <span><b>{formatToPar(e.winner.teamScore)}</b> team score</span>
                      {e.payout > 0 && <span><b>{formatCurrency(e.payout)}</b> each</span>}
                    </div>
                  </>
                ) : e.complete ? (
                  <span className="sch-result-label">Results pending</span>
                ) : (
                  <div className="sch-countdown">
                    <b>{e.daysAway === 0 ? "Today" : e.daysAway === 1 ? "1" : e.daysAway}</b>
                    <span>{e.daysAway === 0 ? "Tee it up!" : e.daysAway === 1 ? "day to go" : "days to go"}</span>
                    {isNext && (
                      <Link to="/next-event" className="sch-preview-link">Matchup preview →</Link>
                    )}
                  </div>
                )}
              </div>

            </li>

          )

        })}

      </ol>

      {!loading && shown.length === 0 && <p className="sch-empty">No events here yet.</p>}

      <section className="sch-guides">
        <div className="sch-guides-head">
          <span className="sch-eyebrow">Course Guides</span>
          <h2>Know the layout before you tee off</h2>
          <p>Hole-by-hole maps with yardages, hazards and 200/150/100 markers. Tap one to open the printable PDF.</p>
        </div>
        <div className="sch-guides-grid">
          {COURSE_LAYOUTS.map((c) => (
            <a key={c.slug} className="sch-guide" href={c.pdf} target="_blank" rel="noopener noreferrer">
              <img src={c.image} alt={`${c.name} course layout`} loading="lazy" />
              <div className="sch-guide-info">
                <h3>{c.name}</h3>
                <span>{c.holes} holes · {c.yards.toLocaleString()} yds · Par {c.par}</span>
                <b>Open PDF ↗</b>
              </div>
            </a>
          ))}
        </div>
        <p className="sch-guides-credit">
          Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>.
          Yardages are approximate.
        </p>
      </section>

    </div>

  )

}

export default Schedule
