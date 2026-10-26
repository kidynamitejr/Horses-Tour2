import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { TeamModal, TeamModalPlayer, TeamModalSection } from "./TeamModal"
import {
  getPlayers,
  getSchedule,
  getMatchEntry,
  getEvents,
} from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { slugify } from "../utils/slugify"
import { ordinal } from "../utils/ordinal"
import { getPartnershipHistory, partnershipLabel } from "../utils/partnership"
import { completedEventIds } from "../utils/eventStatus"
import { getEventForecast } from "../utils/weather"
import { headshotUrl, playerImageFallback } from "../utils/headshot"

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

function TeamDetailModal({ modalTeam, highestCombined, eventNameById, playerIds, summaries, tourRankByName, eventName, onClose }) {

  const leaderGap = highestCombined - modalTeam.combined

  return (

    <TeamModal
      eyebrow={`Matchup Preview · ${eventName}`}
      title={modalTeam.team}
      onClose={onClose}
      tags={
        <>
          {modalTeam.isFavored && <span className="tm-tag tm-tag-gold">★ Favored</span>}
          {modalTeam.isUnderdog && <span className="tm-tag">Underdog</span>}
        </>
      }
    >

      <div className="tm-players">
        {modalTeam.teamPlayers.map((name) => {
          const s = summaries[name]
          const rank = tourRankByName[name]
          return (
            <TeamModalPlayer
              key={name}
              id={playerIds[name]}
              name={name}
              badge={rank ? <><small>Rank</small>{rank}</> : <small>Unranked</small>}
              stats={[
                { label: "Ranking Factor", value: s ? s.avgRankingPoints.toFixed(2) : "-", highlight: true },
                { label: "Events", value: s ? s.eventsPlayed : 0 },
                { label: "Wins", value: s ? s.wins : 0 },
                { label: "Top 3", value: s ? s.topThree : 0 },
              ]}
            />
          )
        })}
      </div>

      <TeamModalSection title="Team Strength">
        <div className="tm-strength">
          <div className="tm-strength-row">
            <span>{modalTeam.team}</span>
            <span className="tm-bar"><span style={{ width: `${highestCombined ? (modalTeam.combined / highestCombined) * 100 : 0}%` }} /></span>
            <b>{modalTeam.combined.toFixed(2)}</b>
          </div>
          {!modalTeam.isFavored && (
            <div className="tm-strength-row is-muted">
              <span>{modalTeam.leaderTeamLabel} (favorite)</span>
              <span className="tm-bar"><span style={{ width: "100%" }} /></span>
              <b>{highestCombined.toFixed(2)}</b>
            </div>
          )}
        </div>
        <p className="tm-note">
          {getPairingTagline(modalTeam.combined)} · Combined Ranking Factor is the average of both players&apos; season Ranking Factor.
          {modalTeam.isFavored
            ? " Highest in the field - this team is the favorite."
            : ` ${leaderGap.toFixed(2)} behind the favorite.`}
        </p>
      </TeamModalSection>

      <TeamModalSection title="Partnership History">
        {modalTeam.history.length === 0 ? (
          <p className="tm-note">First time teaming up - no shared history yet.</p>
        ) : (
          <ul className="tm-list">
            {modalTeam.history.map((h) => (
              <li key={h.eventId}>
                <span>{eventNameById[h.eventId] || `Event ${h.eventId}`}</span>
                <b className={Number(h.placement) === 1 ? "is-win" : ""}>
                  {placementBadge(h.placement)} {ordinal(h.placement)}
                </b>
              </li>
            ))}
          </ul>
        )}
      </TeamModalSection>

    </TeamModal>

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
  // Skips events that already have a Winner, so the next event shows as
  // soon as the last card of the round is in.
  const finishedIds = completedEventIds(events)

  const nextEvent = schedule
    .filter((event) => {
      if (!event.Date) return false
      if (finishedIds.has((event["Event ID"] || "").trim())) return false

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

  // Prize money from the Events tab ("$125"); hidden while it's #N/A.
  const money = (value) => {
    const text = (value || "").trim()
    return /^\$?\d/.test(text) ? (text.startsWith("$") ? text : `$${text}`) : ""
  }
  const nextEventPayout = money(nextEventDetails?.["Winnings ({Per Person)"])
  const nextEventBuyIn = money(nextEventDetails?.["Buy in"])

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


  // Each player's current tour rank (by Ranking Factor, regular players
  // who have played) - shown next to their name in the groupings.
  const tourRankByName = {}

  Object.entries(summaries)
    .filter(([n, s]) => !/\(sub\)/i.test(n) && s.eventsPlayed > 0)
    .sort((a, b) => b[1].avgRankingPoints - a[1].avgRankingPoints)
    .forEach(([n], index) => {
      tourRankByName[n] = index + 1
    })

  return (

    <section className="ev-card">

      <div className="ev-hero">

        <CourseBackground course={nextEvent?.Course} />

        <div className="ev-hero-overlay" />

        <div className="ev-hero-content">

          {!nextEvent ? (

            <>
              <span className="ev-eyebrow">Up Next</span>
              <h2 className="ev-title">No Upcoming Event</h2>
              <p className="ev-meta">Schedule coming soon</p>
            </>

          ) : (

            <>

              <span className="ev-eyebrow">Up Next · Matchup Preview</span>

              <h2 className="ev-title">{nextEvent["Event Name"]}</h2>

              <p className="ev-meta">
                <span>{nextEvent.Date}</span>
                {nextEvent.Course && <span>{nextEvent.Course}</span>}
                {nextEventTeeTime && nextEventTeeTime !== "TBD" && <span>Tee time {nextEventTeeTime}</span>}
              </p>

              <div className="ev-chips">

                {daysUntilNextEvent !== null && (
                  <span className="ev-chip ev-chip-gold">
                    {daysUntilNextEvent === 0
                      ? "Today"
                      : daysUntilNextEvent === 1
                        ? "Tomorrow"
                        : `${daysUntilNextEvent} days away`}
                  </span>
                )}

                {weather && (
                  <span className="ev-chip">
                    {weather.icon} {weather.high}° / {weather.low}°
                    {weather.precipChance > 0 && ` · ${weather.precipChance}% rain`}
                  </span>
                )}

                {nextEventTeams.length > 0 && (
                  <span className="ev-chip">{nextEventTeams.length} teams</span>
                )}

                <Link to="/live" className="ev-chip ev-chip-live">
                  {daysUntilNextEvent === 0 ? "● Live scoring" : "Scorecards"} →
                </Link>

              </div>

            </>

          )}

        </div>

        {nextEvent && nextEventPayout && (
          <div className="ev-purse">
            <span className="ev-purse-label">Winnings</span>
            <b>{nextEventPayout}</b>
            <span className="ev-purse-per">per winner</span>
            {nextEventBuyIn && <small>{nextEventBuyIn} buy-in</small>}
          </div>
        )}

      </div>

      {nextEventTeams.length > 0 && (

        <div className="ev-board">

          <div className="ev-board-head">
            <h3>Groupings</h3>
            <span>Favorite decided by combined Ranking Factor · tap a team for the full preview</span>
          </div>

          <div className="ev-table" role="table" aria-label="Team groupings">

            <div className="ev-row ev-row-head" role="row">
              <span role="columnheader">Team</span>
              <span role="columnheader">Players</span>
              <span role="columnheader">Ranking Factor</span>
              <span role="columnheader" className="ev-col-together">Together</span>
              <span role="columnheader" aria-label="Status" />
            </div>

            {[...nextEventTeams]
              // Team 1, Team 2, ... in order.
              .sort((a, b) => Number(a.team.replace(/\D/g, "")) - Number(b.team.replace(/\D/g, "")))
              .map((t) => (

                <button
                  type="button"
                  role="row"
                  className={`ev-row${t.isFavored ? " is-favored" : ""}${t.isUnderdog ? " is-underdog" : ""}`}
                  key={t.team}
                  onClick={() => setModalTeam(t)}
                >

                  <span className="ev-team" role="cell">{t.team.replace("Team ", "")}</span>

                  <span className="ev-players" role="cell">
                    {t.teamPlayers.map((p) => (
                      <span className="ev-player" key={p}>
                        <img
                          src={headshotUrl(playerIds[p])}
                          alt=""
                          onError={playerImageFallback}
                        />
                        <span className="ev-player-name">{p}</span>
                        {tourRankByName[p] && <span className="ev-player-rank">#{tourRankByName[p]}</span>}
                      </span>
                    ))}
                  </span>

                  <span className="ev-rf" role="cell">
                    <b>{t.combined.toFixed(2)}</b>
                    <span className="ev-rf-track">
                      <span style={{ width: `${highestCombined ? (t.combined / highestCombined) * 100 : 0}%` }} />
                    </span>
                  </span>

                  <span className="ev-together ev-col-together" role="cell">{partnershipLabel(t.history)}</span>

                  <span className="ev-status" role="cell">
                    {t.isFavored && <span className="ev-tag ev-tag-favored">★ Favored</span>}
                    {t.isUnderdog && <span className="ev-tag ev-tag-underdog">Underdog</span>}
                    <span className="ev-chevron" aria-hidden="true">›</span>
                  </span>

                </button>

              ))}

          </div>

        </div>

      )}

      {modalTeam && (
        <TeamDetailModal
          modalTeam={modalTeam}
          highestCombined={highestCombined}
          eventNameById={eventNameById}
          playerIds={playerIds}
          summaries={summaries}
          tourRankByName={tourRankByName}
          eventName={nextEvent ? nextEvent["Event Name"].trim() : ""}
          onClose={() => setModalTeam(null)}
        />
      )}

    </section>

  )

}

export default NextEventFeature
