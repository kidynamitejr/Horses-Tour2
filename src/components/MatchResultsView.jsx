import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { TeamModal, TeamModalPlayer, TeamModalSection } from "./TeamModal"
import confetti from "canvas-confetti"
import { slugify } from "../utils/slugify"
import { ordinal } from "../utils/ordinal"
import { headshotUrl, cutoutUrl, playerImageFallback } from "../utils/headshot"

const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

function formatOverPar(value) {
  if (value === "" || value === null || value === undefined) return value
  const num = Number(value)
  if (isNaN(num)) return value
  return num >= 0 ? `+${value}` : value
}

// Contribution % is only formatted as a percent (e.g. "50.00%") for the
// first event in the sheet - every event after that has the same column
// left as a raw decimal fraction (e.g. "0.6481481481"). Normalize both
// into a proper percentage string instead of showing raw sheet numbers.
function formatContributionPercent(value) {
  if (value === "" || value === null || value === undefined) return ""
  const str = String(value).trim()
  if (str.endsWith("%")) return str
  const num = parseFloat(str)
  if (isNaN(num)) return str
  return `${(num * 100).toFixed(2)}%`
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

function parsePercent(value) {
  const str = String(value ?? "").trim()
  if (!str) return 0
  const num = str.endsWith("%") ? parseFloat(str) : parseFloat(str) * 100
  return isNaN(num) ? 0 : num
}

function TeamRecapModal({ modalTeam, playerIds, eventName, teamCount, onClose }) {

  const isChampion = modalTeam.teamPlacement === 1
  const players = modalTeam.players
  const teamPoints = players.reduce((sum, p) => sum + p.matchPoints, 0)
  const shares = players.map((p) => parsePercent(p.contributionPercent))

  return (

    <TeamModal
      eyebrow={`Match Recap · ${eventName}`}
      title={isChampion ? "Champions" : `${ordinal(modalTeam.teamPlacement)} Place`}
      onClose={onClose}
      tags={
        <>
          <span className={`tm-tag${isChampion ? " tm-tag-gold" : ""}`}>
            {isChampion ? "🏆 " : ""}{formatOverPar(modalTeam.teamScore)}
          </span>
          {teamCount > 0 && <span className="tm-tag">{ordinal(modalTeam.teamPlacement)} of {teamCount}</span>}
        </>
      }
    >

      <div className="tm-players">
        {players.map((p) => (
          <TeamModalPlayer
            key={p.name}
            id={playerIds[p.name]}
            name={p.name}
            badge={<><small>Finish</small>{p.individualPlacement}</>}
            stats={[
              { label: "Points Earned", value: p.matchPoints.toFixed(2), highlight: true },
              { label: "Contribution", value: formatContributionPercent(p.contributionPercent) },
              { label: "Contributions", value: p.contributions || "-" },
              {
                label: "Movement",
                value: p.movement === null || p.movement === undefined
                  ? "—"
                  : p.movement > 0 ? `▲ ${p.movement}` : p.movement < 0 ? `▼ ${Math.abs(p.movement)}` : "—",
              },
            ]}
          />
        ))}
      </div>

      {players.length > 1 && (
        <TeamModalSection title="Contribution Split">
          <div className="tm-split">
            {players.map((p, i) => (
              <span
                key={p.name}
                className={`tm-split-part tm-split-${i}`}
                style={{ flexGrow: shares[i] || 1 }}
                title={`${p.name}: ${formatContributionPercent(p.contributionPercent)}`}
              >
                {shares[i] >= 18 && `${Math.round(shares[i])}%`}
              </span>
            ))}
          </div>
          <div className="tm-split-legend">
            {players.map((p, i) => (
              <span key={p.name}><i className={`tm-split-${i}`} />{p.name}</span>
            ))}
          </div>
        </TeamModalSection>
      )}

      <TeamModalSection title="Team Result">
        <ul className="tm-list">
          <li><span>Team finish</span><b className={isChampion ? "is-win" : ""}>{ordinal(modalTeam.teamPlacement)}</b></li>
          <li><span>Team score</span><b>{formatOverPar(modalTeam.teamScore)}</b></li>
          <li><span>Placement points available</span><b>{players[0] ? players[0].teamPointsAvailable : "-"}</b></li>
          <li><span>Points earned by the team</span><b>{teamPoints.toFixed(2)}</b></li>
        </ul>
      </TeamModalSection>

    </TeamModal>

  )

}

// Renders the full "hero card" results view (course photo background,
// teams ranked by finish, click a team for an individual stat recap) for
// one specific event - used both for the home page's Last Match feature
// and for any match opened from the Past Matches page.
function MatchResultsView({ eventId, matchEntry, schedule, playerIds, eyebrow, onCollapse }) {

  const [modalTeam, setModalTeam] = useState(null)
  const [view, setView] = useState("teams")

  const playedRows = matchEntry.filter((row) => row.Player && row.Contributions)

  const eventIds = [...new Set(playedRows.map((row) => Number(row["Event ID"])))]
    .sort((a, b) => a - b)

  const eventIndex = eventIds.indexOf(Number(eventId))
  const previousEventId = eventIndex > 0 ? eventIds[eventIndex - 1] : undefined

  // Ranks every player in a given event by Match Points (ties broken by
  // Contributions) - this is each player's individual placement "out of
  // everybody," independent of which team they were on.
  function rankByPoints(id) {

    return playedRows
      .filter((row) => Number(row["Event ID"]) === id)
      .map((row) => ({
        player: row.Player.trim(),
        matchPoints: parseFloat(row["Match Ranking Points"]) || 0,
        contributions: parseFloat(row.Contributions) || 0,
      }))
      .sort((a, b) => b.matchPoints - a.matchPoints || b.contributions - a.contributions)

  }

  const individualPlacementByPlayer = {}

  rankByPoints(Number(eventId)).forEach((r, i) => {
    individualPlacementByPlayer[r.player] = i + 1
  })

  const previousIndividualPlacementByPlayer = {}

  if (previousEventId !== undefined) {
    rankByPoints(previousEventId).forEach((r, i) => {
      previousIndividualPlacementByPlayer[r.player] = i + 1
    })
  }

  const teamsByLetter = {}

  playedRows
    .filter((row) => Number(row["Event ID"]) === Number(eventId))
    .forEach((row) => {

      const name = row.Player.trim()

      if (!teamsByLetter[row.Team]) {
        teamsByLetter[row.Team] = {
          team: row.Team,
          teamPlacement: Number(row.Placement),
          teamScore: row["Team Score"],
          players: [],
        }
      }

      const currentPlacement = individualPlacementByPlayer[name]
      const prevPlacement = previousIndividualPlacementByPlayer[name]

      const movement =
        currentPlacement !== undefined && prevPlacement !== undefined
          ? prevPlacement - currentPlacement
          : null

      teamsByLetter[row.Team].players.push({
        name,
        matchPoints: parseFloat(row["Match Ranking Points"]) || 0,
        // The team's flat placement-based points (same for both
        // teammates) - the "pool" that Contribution % splits between
        // them to produce their individual Match Points.
        teamPointsAvailable: parseFloat(row["Power Score Earned"]) || 0,
        teamPlacement: Number(row.Placement),
        contributions: row.Contributions,
        contributionPercent: row["Contribution %"],
        individualPlacement: currentPlacement,
        movement,
      })

    })

  const teams = Object.values(teamsByLetter).sort((a, b) => a.teamPlacement - b.teamPlacement)

  const celebratedEventId = useRef(null)
  const confettiCanvasRef = useRef(null)
  const sectionRef = useRef(null)

  // A little confetti burst the first time a match's results (with an
  // actual champion) actually scroll into view for this event - waits
  // for visibility (via IntersectionObserver) instead of firing the
  // instant the component mounts, since on the home page this card sits
  // below the fold and would otherwise finish animating before anyone
  // scrolls down to see it. Guarded by a ref so it only fires once per
  // event. Bound to our own canvas (instead of the default full-page
  // one) so it stays contained inside this card instead of covering the
  // screen.
  useEffect(() => {

    if (teams.length === 0) return
    if (celebratedEventId.current === eventId) return
    if (!sectionRef.current || !confettiCanvasRef.current) return

    const canvas = confettiCanvasRef.current

    const observer = new IntersectionObserver(
      ([entry]) => {

        if (!entry.isIntersecting) return
        if (celebratedEventId.current === eventId) return

        celebratedEventId.current = eventId

        const fireConfetti = confetti.create(canvas, {
          resize: true,
          useWorker: true,
        })

        // Bursts from near the top of the card and falls down over the
        // results board below.
        fireConfetti({
          particleCount: 160,
          spread: 100,
          startVelocity: 38,
          ticks: 420,
          origin: { y: 0.18 },
          colors: ["#d9b64a", "#f4d374", "#002140", "#ffffff"],
        })

        observer.disconnect()

      },
      { threshold: 0.4 }
    )

    observer.observe(sectionRef.current)

    return () => observer.disconnect()

  }, [eventId, teams.length])

  // Every player from every team, ranked 1st to last by how they
  // individually did that match (Match Ranking Points) - independent of
  // who their teammate was or how the team as a whole finished.
  const allPlayersRanked = teams
    .flatMap((t) => t.players)
    .sort((a, b) => a.individualPlacement - b.individualPlacement)

  const event = schedule.find((e) => e["Event ID"] === String(eventId))
  const eventName = event ? event["Event Name"] : `Event ${eventId}`

  const champions = teams.find((t) => t.teamPlacement === 1)

  // Podium: the top three teams, shown 2nd - 1st - 3rd.
  const podium = teams.slice(0, 3)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean)
  const MEDALS = ["gold", "silver", "bronze"]
  const placeLabel = (t) => {
    const tied = teams.filter((x) => x.teamPlacement === t.teamPlacement).length > 1
    return `${tied ? "T" : ""}${ordinal(t.teamPlacement)}`
  }

  return (

    <section className="ev-card ev-card-recap" ref={sectionRef}>

      {/* Covers the whole card (photo + results) so the confetti falls over both */}
      <canvas ref={confettiCanvasRef} className="confetti-canvas ev-confetti" />

      <div className="ev-hero ev-hero-compact">

        <CourseBackground course={event?.Course} />

        <div className="ev-hero-overlay" />

        {onCollapse && (
          <button
            type="button"
            className="match-collapse-button"
            onClick={onCollapse}
            aria-label="Collapse"
          >
            ▲ Collapse
          </button>
        )}

        <div className="ev-hero-content">

          <span className="ev-eyebrow">{eyebrow} · Final Results</span>

          <h2 className="ev-title">{eventName}</h2>

          <p className="ev-meta">
            {event?.Date && <span>{event.Date}</span>}
            {event?.Course && <span>{event.Course}</span>}
            {teams.length > 0 && <span>{teams.length} teams</span>}
          </p>

          {champions && (
            <div className="ev-champions">
              <span className="ev-champions-label">🏆 Champions</span>
              <span className="ev-champions-names">
                {champions.players.map((p) => p.name).join(" & ")}
              </span>
              <span className="ev-champions-score">{formatOverPar(champions.teamScore)}</span>
            </div>
          )}

        </div>

      </div>

      {teams.length > 0 && (

        <div className="ev-board">

          {podium.length >= 2 && (
            <div className="pod" aria-label="Podium">
              <span className="pod-title">Podium</span>
              <div className="pod-stage">
                {podiumOrder.map((t) => {
                  const medal = MEDALS[podium.indexOf(t)]
                  return (
                    <button
                      type="button"
                      key={t.team}
                      className={`pod-col pod-${medal}`}
                      onClick={() => setModalTeam(t)}
                      aria-label={`${placeLabel(t)}: ${t.players.map((p) => p.name).join(" and ")}`}
                    >
                      <span className="pod-figures">
                        {t.players.map((p) => (
                          <img
                            key={p.name}
                            src={cutoutUrl(playerIds[p.name])}
                            alt=""
                            onError={playerImageFallback}
                          />
                        ))}
                      </span>
                      <span className="pod-step">
                        <span className="pod-place">{placeLabel(t)}</span>
                        <span className="pod-names">
                          {t.players.map((p) => <b key={p.name}>{p.name}</b>)}
                        </span>
                        <span className="pod-score">{formatOverPar(t.teamScore)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="ev-board-head">
            <h3>{view === "teams" ? "Final Leaderboard" : "Individual Placements"}</h3>

            <div className="ev-segment" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={view === "teams"}
                className={view === "teams" ? "active" : ""}
                onClick={() => setView("teams")}
              >
                Teams
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "individual"}
                className={view === "individual" ? "active" : ""}
                onClick={() => setView("individual")}
              >
                Individual
              </button>
            </div>
          </div>

          {view === "teams" ? (

            <div className="ev-table ev-table-recap" role="table" aria-label="Team results">

              <div className="ev-row ev-row-head" role="row">
                <span role="columnheader">Pos</span>
                <span role="columnheader">Team</span>
                <span role="columnheader">To Par</span>
                <span role="columnheader" className="ev-col-together">Top Contributor</span>
                <span role="columnheader">Pts</span>
                <span role="columnheader" aria-label="Details" />
              </div>

              {teams.map((t) => {

                const isChampion = t.teamPlacement === 1
                const top = [...t.players].sort((a, b) => b.matchPoints - a.matchPoints)[0]

                return (

                  <button
                    type="button"
                    role="row"
                    className={`ev-row${isChampion ? " is-champion" : ""}`}
                    key={t.team}
                    onClick={() => setModalTeam(t)}
                  >

                    <span className="ev-team" role="cell">{isChampion ? "🏆" : t.teamPlacement}</span>

                    <span className="ev-players" role="cell">
                      {t.players.map((p) => (
                        <span className="ev-player" key={p.name}>
                          <img
                            src={headshotUrl(playerIds[p.name])}
                            alt=""
                            onError={playerImageFallback}
                          />
                          <span className="ev-player-name">{p.name}</span>
                        </span>
                      ))}
                    </span>

                    <span className="ev-topar" role="cell">{formatOverPar(t.teamScore)}</span>

                    <span className="ev-together ev-col-together" role="cell">
                      {top ? `${top.name} · ${formatContributionPercent(top.contributionPercent)}` : "-"}
                    </span>

                    <span className="ev-pts" role="cell">
                      {t.players.reduce((sum, p) => sum + p.matchPoints, 0).toFixed(2)}
                    </span>

                    <span className="ev-status" role="cell">
                      <span className="ev-chevron" aria-hidden="true">›</span>
                    </span>

                  </button>

                )

              })}

            </div>

          ) : (

            <div className="table-scroll ev-ind-scroll">

              <table className="ev-ind-table">

                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>
                      <span className="label-full">Team Finish</span>
                      <span className="label-short">Team</span>
                    </th>
                    <th className="hide-on-phone">Team Pts</th>
                    <th>
                      <span className="label-full">Contribution</span>
                      <span className="label-short">Contr.</span>
                    </th>
                    <th>
                      <span className="label-full">Points Earned</span>
                      <span className="label-short">Pts</span>
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {allPlayersRanked.map((player) => (

                    <tr key={player.name} className={player.individualPlacement <= 3 ? "is-podium" : ""}>

                      <td className="ev-ind-pos">{player.individualPlacement}</td>

                      <td>
                        <Link to={`/player-profile/${playerIds[player.name]}`} className="ev-ind-player">
                          <img
                            src={headshotUrl(playerIds[player.name])}
                            alt=""
                            onError={playerImageFallback}
                          />
                          {player.name}
                        </Link>
                      </td>

                      <td>{ordinal(player.teamPlacement)}</td>

                      <td className="hide-on-phone">{player.teamPointsAvailable.toFixed(1)}</td>

                      <td>{formatContributionPercent(player.contributionPercent)}</td>

                      <td className="ev-ind-pts">{player.matchPoints.toFixed(2)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      )}

      {modalTeam && (
        <TeamRecapModal
          modalTeam={modalTeam}
          playerIds={playerIds}
          eventName={eventName}
          teamCount={teams.length}
          onClose={() => setModalTeam(null)}
        />
      )}

    </section>

  )

}

export default MatchResultsView
