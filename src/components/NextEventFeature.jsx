import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import {
  getPlayers,
  getSchedule,
  getMatchEntry,
  getEvents,
} from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { slugify } from "../utils/slugify"
import { ordinal } from "../utils/ordinal"
import { getEventForecast } from "../utils/weather"

const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

// A playful tier label based on the team's combined Ranking Factor -
// pure flavor text, doesn't affect the Favored calculation itself.
function getPairingTagline(combined) {
  if (combined >= 4.5) return "🔥 Elite Pairing"
  if (combined >= 3) return "💪 Strong Contenders"
  if (combined >= 1.5) return "⚡ Building Momentum"
  return "🌱 Wildcard Duo"
}

// Small medal callout for a top-3 finish, otherwise just the ordinal.
function placementBadge(placement) {
  const num = Number(placement)
  if (num === 1) return "🥇"
  if (num === 2) return "🥈"
  if (num === 3) return "🥉"
  return null
}

// Finds every past played event where both of these two players were on
// the same team, and what place that team finished.
function getPartnershipHistory(matchEntry, playerA, playerB) {

  const byEventTeam = {}

  matchEntry.forEach((row) => {

    if (!row.Player || !row.Contributions) return

    const key = `${row["Event ID"]}|${row.Team}`

    if (!byEventTeam[key]) byEventTeam[key] = []

    byEventTeam[key].push(row)

  })

  return Object.values(byEventTeam)
    .filter((rows) => {
      const names = rows.map((r) => r.Player.trim())
      return names.includes(playerA) && names.includes(playerB)
    })
    .map((rows) => ({
      eventId: rows[0]["Event ID"],
      placement: rows[0].Placement,
    }))
    .sort((a, b) => Number(a.eventId) - Number(b.eventId))

}

function CourseBackground({ course }) {

  const [extIndex, setExtIndex] = useState(0)

  if (!course || extIndex >= COURSE_IMAGE_EXTENSIONS.length) {
    return <div className="next-event-fallback-bg" />
  }

  const src = `${import.meta.env.BASE_URL}images/courses/${slugify(course)}.${COURSE_IMAGE_EXTENSIONS[extIndex]}`

  return (
    <img
      src={src}
      alt=""
      className="next-event-bg-img"
      onError={() => setExtIndex((i) => i + 1)}
    />
  )

}

// On the collapsed matchup card, the headshot is plain (clicking
// anywhere on the card opens the team detail modal instead). Inside
// that modal, the headshot + name become a link straight to the
// player's profile page - that's the only place the link is available.
function PlayerChip({ name, playerIds, large, linked, ranking }) {

  const id = playerIds[name]

  const content = (
    <>
      <img
        src={`${import.meta.env.BASE_URL}images/players/${id}.jpg`}
        alt={name}
        className="next-event-avatar"
        onError={(e) => {
          e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
        }}
      />
      <span>{name}</span>
      {ranking !== undefined && (
        <span className="next-event-player-ranking">
          {ranking.toFixed(1)} Ranking Factor
        </span>
      )}
    </>
  )

  const className = `next-event-player${large ? " next-event-player-large" : ""}`

  if (!linked) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link
      to={`/player-profile/${id}`}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  )

}

function TeamDetailModal({ modalTeam, highestCombined, eventNameById, playerIds, summaries, onClose }) {

  return createPortal(

    <div className="next-event-modal-overlay" onClick={onClose}>

      <div className="next-event-modal" onClick={(e) => e.stopPropagation()}>

        <button
          type="button"
          className="next-event-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="next-event-modal-header">

          <p className="next-event-modal-eyebrow">Matchup Preview</p>

          <span className="next-event-team-tag next-event-modal-team-tag">
            {modalTeam.team}
          </span>

          {modalTeam.isFavored && (
            <span className="next-event-favored-badge next-event-modal-favored-badge">
              ★ Favored to Win
            </span>
          )}

          {modalTeam.isUnderdog && (
            <span className="next-event-underdog-badge next-event-modal-underdog-badge">
              Underdog
            </span>
          )}

        </div>

        <div className="next-event-modal-players">

          <PlayerChip
            name={modalTeam.teamPlayers[0]}
            playerIds={playerIds}
            large
            linked
            ranking={summaries[modalTeam.teamPlayers[0]]?.avgRankingPoints}
          />

          {modalTeam.teamPlayers.length > 1 && (
            <>
              <span className="next-event-teammate-divider next-event-modal-divider">&amp;</span>
              <PlayerChip
                name={modalTeam.teamPlayers[1]}
                playerIds={playerIds}
                large
                linked
                ranking={summaries[modalTeam.teamPlayers[1]]?.avgRankingPoints}
              />
            </>
          )}

        </div>

        <p className="next-event-tagline">{getPairingTagline(modalTeam.combined)}</p>

        <div className="next-event-detail-block">

          <h4>
            🏌️ {modalTeam.isFavored
              ? "Favored to Win"
              : modalTeam.isUnderdog
                ? "Underdog"
                : "Combined Ranking Factor"}
          </h4>

          <p>
            This team's combined Ranking Factor is{" "}
            <strong>{modalTeam.combined.toFixed(1)}</strong> — the average of
            both players' season Ranking Factor.
            {modalTeam.isFavored
              ? " It's the highest combined average of any team in this matchup, making them the favorite to finish on top."
              : modalTeam.isUnderdog
                ? " It's the lowest combined average of any team in this matchup, making them the underdog heading into this event."
                : ` ${modalTeam.leaderTeamLabel} leads the field at ${highestCombined.toFixed(1)}.`}
          </p>

        </div>

        <div className="next-event-detail-block">

          <h4>⛳ Partnership History</h4>

          {modalTeam.history.length === 0 ? (
            <p className="next-event-first-pairing">
              🤝 First Time Teaming Up! No shared history yet — this is a
              fresh pairing.
            </p>
          ) : (
            <ul className="next-event-history-list">
              {modalTeam.history.map((h) => (
                <li key={h.eventId}>
                  <span>{eventNameById[h.eventId] || `Event ${h.eventId}`}</span>
                  <span className="next-event-history-placement">
                    {placementBadge(h.placement)} {ordinal(h.placement)}
                  </span>
                </li>
              ))}
            </ul>
          )}

        </div>

      </div>

    </div>,

    document.body

  )

}

function NextEventFeature() {

  const [playerIds, setPlayerIds] = useState({})
  const [schedule, setSchedule] = useState([])
  const [events, setEvents] = useState([])
  const [summaries, setSummaries] = useState({})
  const [matchEntry, setMatchEntry] = useState([])
  const [modalTeam, setModalTeam] = useState(null)
  const [weather, setWeather] = useState(null)

  useEffect(() => {

    getPlayers().then((data) => {

      const idsByName = {}

      data.forEach((player) => {
        idsByName[player.Name] = player["Player ID"]
      })

      setPlayerIds(idsByName)

    })

    getSchedule().then(setSchedule)
    getEvents().then(setEvents)

    getMatchEntry().then((data) => {
      setMatchEntry(data)
      setSummaries(getPlayerSummaries(data))
    })

  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // "Upcoming" is decided purely by date rather than the sheet's Status
  // column - that column now holds the event type ("Regular"/"Major")
  // instead of "Played"/"Planned", so it can't be used to tell whether an
  // event has already happened.
  const nextEvent = schedule
    .filter((event) => {
      if (!event.Date) return false

      const eventDate = new Date(event.Date)

      if (isNaN(eventDate)) return false

      eventDate.setHours(0, 0, 0, 0)

      return eventDate >= today
    })
    .sort((a, b) => new Date(a.Date) - new Date(b.Date))[0]

  let daysUntilNextEvent = null

  if (nextEvent?.Date) {
    const eventDate = new Date(nextEvent.Date)
    if (!isNaN(eventDate)) {
      eventDate.setHours(0, 0, 0, 0)
      daysUntilNextEvent = Math.round((eventDate - today) / (1000 * 60 * 60 * 24))
    }
  }

  const nextEventId = nextEvent?.["Event ID"]
  const nextEventDate = nextEvent?.Date
  const nextEventCourse = nextEvent?.Course

  // The course address and tee time live on the Events tab, not Schedule.
  const nextEventDetails = events.find(
    (e) => e["Event ID"] === nextEventId
  )
  const nextEventAddress = nextEventDetails?.Address
  const nextEventTeeTime = nextEventDetails?.["Tee Time"]?.trim()

  useEffect(() => {

    let cancelled = false

    const forecastPromise = (nextEventId && nextEventDate && (nextEventAddress || nextEventCourse))
      ? getEventForecast(nextEventAddress, nextEventDate, nextEventCourse)
      : Promise.resolve(null)

    forecastPromise.then((forecast) => {
      if (!cancelled) setWeather(forecast)
    })

    return () => { cancelled = true }

  }, [nextEventId, nextEventDate, nextEventAddress, nextEventCourse])

  // Teams read straight from the Match Entry tab's Team column, grouped
  // by Event ID + team letter - the same source past-match recaps use.
  // Unlike a played match, an upcoming event's rows have no Contributions
  // yet, so this only requires a Player and a Team letter to be filled
  // in, not a completed round.
  const rawTeams = []

  if (nextEventId) {

    const byLetter = {}

    matchEntry.forEach((row) => {

      if (!row.Player || !row.Team) return
      if (row["Event ID"] !== nextEventId) return

      const letter = row.Team.trim()

      if (!letter) return

      if (!byLetter[letter]) byLetter[letter] = []

      byLetter[letter].push(row.Player.trim())

    })

    // Displayed as "Team 1", "Team 2", etc. in letter order (A -> 1,
    // B -> 2, ...) rather than showing the sheet's own letter.
    Object.keys(byLetter).sort().forEach((letter, index) => {
      rawTeams.push([`Team ${index + 1}`, byLetter[letter]])
    })

  }

  const eventNameById = {}

  schedule.forEach((e) => {
    eventNameById[e["Event ID"]] = e["Event Name"].trim()
  })

  // Favored team = whichever pairing has the highest combined Ranking
  // Factor (average of both players' season Ranking Factor). A player
  // who hasn't been ranked yet (brand new, no events played) counts as
  // 0.0 toward the average.
  const teamsWithScores = rawTeams.map(([team, teamPlayers]) => {

    const scores = teamPlayers.map((p) => summaries[p]?.avgRankingPoints ?? 0)

    const combined = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0

    const history = teamPlayers.length > 1
      ? getPartnershipHistory(matchEntry, teamPlayers[0], teamPlayers[1])
      : []

    return { team, teamPlayers, combined, history }

  })

  const highestCombined = teamsWithScores.length > 0
    ? Math.max(...teamsWithScores.map((t) => t.combined))
    : 0

  // Underdog = whichever pairing has the lowest combined Ranking Factor -
  // only meaningful when there's more than one team and the field isn't
  // completely tied (e.g. every pairing brand new with no history yet).
  const lowestCombined = teamsWithScores.length > 0
    ? Math.min(...teamsWithScores.map((t) => t.combined))
    : 0

  const leaderTeamLabel = teamsWithScores.find((t) => t.combined === highestCombined)?.team ?? ""

  const hasSpread = teamsWithScores.length > 1 && highestCombined > lowestCombined

  const nextEventTeams = teamsWithScores.map((t) => ({
    ...t,
    isFavored: t.combined === highestCombined && t.combined > 0,
    isUnderdog: hasSpread && t.combined === lowestCombined,
    leaderTeamLabel,
  }))

  return (

    <section className="next-event-feature">

      <CourseBackground course={nextEvent?.Course} />

      <div className="next-event-overlay" />

      <div className="next-event-content">

        {!nextEvent ? (

          <>
            <p className="next-event-eyebrow">Up Next</p>
            <h2 className="next-event-title">No Upcoming Event</h2>
            <p className="next-event-meta">Schedule Coming Soon</p>
          </>

        ) : (

          <>

            <p className="next-event-eyebrow">Up Next</p>

            <h2 className="next-event-title">{nextEvent["Event Name"]}</h2>

            <div className="next-event-badges">

              {daysUntilNextEvent !== null && (
                <span className="next-event-countdown">
                  {daysUntilNextEvent === 0
                    ? "Today!"
                    : daysUntilNextEvent === 1
                      ? "1 Day Away"
                      : `${daysUntilNextEvent} Days Away`}
                </span>
              )}

              {weather && (
                <span className="next-event-weather">
                  {weather.icon} {weather.high}° / {weather.low}°
                  {weather.precipChance > 0 && ` · ${weather.precipChance}% rain`}
                </span>
              )}

            </div>

            <p className="next-event-meta">
              {nextEvent.Date}
              {nextEvent.Course && <span className="next-event-dot">•</span>}
              {nextEvent.Course}
              {nextEventTeeTime && nextEventTeeTime !== "TBD" && (
                <>
                  <span className="next-event-dot">•</span>
                  {nextEventTeeTime}
                </>
              )}
            </p>

            {nextEventTeams.length > 0 && (

              <div className="next-event-matchups">

                {nextEventTeams.map((t) => (

                  <div
                    className={`next-event-matchup-card${t.isFavored ? " next-event-favored" : ""}${t.isUnderdog ? " next-event-underdog" : ""}`}
                    key={t.team}
                    onClick={() => setModalTeam(t)}
                  >

                    <span className="next-event-team-tag">{t.team}</span>

                    {t.isFavored && (
                      <span className="next-event-favored-badge">★ Favored</span>
                    )}

                    {t.isUnderdog && (
                      <span className="next-event-underdog-badge">Underdog</span>
                    )}

                    <div className="next-event-matchup-players">

                      <PlayerChip name={t.teamPlayers[0]} playerIds={playerIds} />

                      {t.teamPlayers.length > 1 && (
                        <>
                          <span className="next-event-teammate-divider">&amp;</span>
                          <PlayerChip name={t.teamPlayers[1]} playerIds={playerIds} />
                        </>
                      )}

                    </div>

                  </div>

                ))}

              </div>

            )}

          </>

        )}

      </div>

      {modalTeam && (
        <TeamDetailModal
          modalTeam={modalTeam}
          highestCombined={highestCombined}
          eventNameById={eventNameById}
          playerIds={playerIds}
          summaries={summaries}
          onClose={() => setModalTeam(null)}
        />
      )}

    </section>

  )

}

export default NextEventFeature
