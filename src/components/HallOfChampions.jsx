import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getSchedule, getMatchEntry, getPlayers, getEvents } from "../data/googleSheets"
import { formatCurrency } from "../utils/winnings"
import { Lightbox } from "./Gallery"
import { TrophyIcon } from "./Icons"

const BASE = import.meta.env.BASE_URL

function formatOverPar(value) {
  if (value === "" || value === null || value === undefined) return value
  const num = Number(value)
  if (isNaN(num)) return value
  if (num === 0) return "E"
  return num > 0 ? `+${value}` : value
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

function money(value) {
  const num = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function Headshot({ id, name, size = 40 }) {
  return (
    <img
      className="hoc-headshot"
      src={`${BASE}images/players/${id || "default"}.jpg`}
      alt={name}
      width={size}
      height={size}
      onError={(e) => {
        e.target.src = `${BASE}images/players/default.jpg`
      }}
    />
  )
}

function ChampionNames({ players, playerIds, size }) {
  return (
    <div className="hoc-names">
      {players.map((name) => (
        <Link key={name} to={`/player-profile/${playerIds[name]}`} className="hoc-name" onClick={(e) => e.stopPropagation()}>
          <Headshot id={playerIds[name]} name={name} size={size} />
          <span>{name}</span>
        </Link>
      ))}
    </div>
  )
}

function HallOfChampions() {

  const [champions, setChampions] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [openIndex, setOpenIndex] = useState(null)

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

        const winningsKey = events[0] ? Object.keys(events[0]).find((k) => /winnings/i.test(k)) : null

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
              totalTeams: Number(row["Total Teams"]) || null,
            }
          }

          byEvent[eventId].players.push(row.Player.trim())

        })

        const list = Object.values(byEvent)
          .map((c) => {
            const event = eventById[c.eventId]
            const details = eventsTabById[c.eventId] || {}
            const type = (details["Event Type"] || "").trim()
            return {
              ...c,
              eventName: event ? event["Event Name"].trim() : `Event ${c.eventId}`,
              date: event ? event.Date : "",
              year: event ? getEventYear(event.Date) : "",
              course: ((details.Course || event?.Course) || "").trim(),
              type,
              isMajor: ["major", "championship"].includes(type.toLowerCase()),
              // A photo the tour owner pastes a link to in the Events
              // tab's "Winner Picture" column.
              image: details["Winner Picture"] || "",
              payout: winningsKey ? money(details[winningsKey]) : 0,
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

  // Only champions with a photo can be enlarged.
  const photos = champions
    .filter((c) => c.image)
    .map((c) => ({
      eventId: c.eventId,
      Image: c.image,
      Caption: `${c.year} ${c.eventName} · ${c.players.join(" & ")}`,
    }))

  function openPhoto(eventId) {
    const index = photos.findIndex((p) => p.eventId === eventId)
    if (index !== -1) setOpenIndex(index)
  }

  // Title counts per player (wins, majors), most first.
  const titles = {}
  champions.forEach((c) => {
    c.players.forEach((name) => {
      if (!titles[name]) titles[name] = { name, wins: 0, majors: 0, earnings: 0 }
      titles[name].wins += 1
      if (c.isMajor) titles[name].majors += 1
      titles[name].earnings += c.payout
    })
  })
  const titleLeaders = Object.values(titles).sort((a, b) => b.wins - a.wins || b.majors - a.majors || b.earnings - a.earnings)

  const reigning = champions[0]
  const totalPurse = champions.reduce((sum, c) => sum + c.payout * c.players.length, 0)

  if (loading) {
    return (
      <section className="card">
        <h2>Hall of Champions</h2>
        <p>Loading champions...</p>
      </section>
    )
  }

  if (champions.length === 0) {
    return (
      <section className="card">
        <h2>Hall of Champions</h2>
        <p>No champions crowned yet.</p>
      </section>
    )
  }

  return (

    <div className="hoc">

      {/* ---------- Reigning champions ---------- */}
      <section className="hoc-feature">

        <button
          type="button"
          className="hoc-feature-photo"
          onClick={() => openPhoto(reigning.eventId)}
          disabled={!reigning.image}
          aria-label={reigning.image ? `Enlarge photo from ${reigning.eventName}` : undefined}
        >
          {reigning.image ? (
            <img src={reigning.image} alt={reigning.eventName} />
          ) : (
            <div className="hoc-photo-fallback"><TrophyIcon size={64} /></div>
          )}
          {reigning.image && <span className="hoc-zoom">⤢</span>}
        </button>

        <div className="hoc-feature-body">
          <span className="hoc-eyebrow">Reigning Champions</span>
          <h2>
            {reigning.year} {reigning.eventName}
            {reigning.isMajor && <span className="hoc-major-tag">★ {reigning.type}</span>}
          </h2>
          <p className="hoc-feature-meta">
            {reigning.date}
            {reigning.course && <> · {reigning.course}</>}
          </p>

          <ChampionNames players={reigning.players} playerIds={playerIds} size={52} />

          <dl className="hoc-feature-stats">
            <div>
              <dt>Winning Score</dt>
              <dd>{formatOverPar(reigning.teamScore)}</dd>
            </div>
            <div>
              <dt>Field</dt>
              <dd>{reigning.totalTeams ? `${reigning.totalTeams} teams` : "-"}</dd>
            </div>
            <div>
              <dt>Payout (each)</dt>
              <dd>{reigning.payout ? formatCurrency(reigning.payout) : "-"}</dd>
            </div>
          </dl>
        </div>

      </section>

      {/* ---------- Tour summary + most titles ---------- */}
      <section className="hoc-row">

        <div className="hoc-summary">
          <div>
            <b>{champions.length}</b>
            <span>Titles awarded</span>
          </div>
          <div>
            <b>{champions.filter((c) => c.isMajor).length}</b>
            <span>Majors decided</span>
          </div>
          <div>
            <b>{titleLeaders.length}</b>
            <span>Different champions</span>
          </div>
          <div>
            <b>{formatCurrency(totalPurse)}</b>
            <span>Paid to winners</span>
          </div>
        </div>

        <div className="hoc-leaders">
          <h3>Most Titles</h3>
          <ol>
            {titleLeaders.slice(0, 6).map((p, index) => (
              <li key={p.name}>
                <span className="hoc-leader-rank">{index + 1}</span>
                <Link to={`/player-profile/${playerIds[p.name]}`} className="hoc-name">
                  <Headshot id={playerIds[p.name]} name={p.name} size={34} />
                  <span>{p.name}</span>
                </Link>
                <span className="hoc-trophies" aria-label={`${p.wins} titles`}>
                  {Array.from({ length: p.wins }, (_, i) => (
                    <TrophyIcon key={i} size={16} className={i < p.majors ? "is-major" : ""} />
                  ))}
                </span>
                <b>{p.wins}</b>
              </li>
            ))}
          </ol>
          <p className="hoc-legend"><TrophyIcon size={14} className="is-major" /> Major title</p>
        </div>

      </section>

      {/* ---------- Champions board ---------- */}
      <section className="card hoc-board">

        <h2>Champions Board</h2>

        <div className="hoc-grid">

          {champions.map((c) => (

            <article className={`hoc-card${c.isMajor ? " is-major" : ""}`} key={c.eventId}>

              <button
                type="button"
                className="hoc-card-photo"
                onClick={() => openPhoto(c.eventId)}
                disabled={!c.image}
                aria-label={c.image ? `Enlarge photo from ${c.eventName}` : undefined}
              >
                {c.image ? (
                  <img src={c.image} alt={c.eventName} loading="lazy" />
                ) : (
                  <div className="hoc-photo-fallback"><TrophyIcon size={44} /></div>
                )}
                <span className="hoc-year">{c.year}</span>
                {c.isMajor && <span className="hoc-ribbon">★ {c.type}</span>}
                {c.image && <span className="hoc-zoom">⤢</span>}
              </button>

              <div className="hoc-card-body">
                <h3>{c.eventName}</h3>
                <p className="hoc-card-meta">{c.date}{c.course && ` · ${c.course}`}</p>

                <ChampionNames players={c.players} playerIds={playerIds} size={34} />

                <div className="hoc-card-foot">
                  <span>
                    <small>Score</small>
                    <b>{formatOverPar(c.teamScore)}</b>
                  </span>
                  <span>
                    <small>Field</small>
                    <b>{c.totalTeams || "-"}</b>
                  </span>
                  <span>
                    <small>Payout</small>
                    <b>{c.payout ? formatCurrency(c.payout) : "-"}</b>
                  </span>
                </div>
              </div>

            </article>

          ))}

        </div>

      </section>

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}

    </div>

  )

}

export default HallOfChampions
