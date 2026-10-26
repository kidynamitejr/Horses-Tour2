import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getPlayers, getMatchEntry, getEvents } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { buildPlayerProfiles } from "../utils/playerProfile"
import { ordinal } from "../utils/ordinal"
import { UsaFlag, ChevronDownIcon } from "./Icons"
import { headshotUrl, cutoutUrl, nextPlayerImage, playerImageFallback } from "../utils/headshot"

// Ranks every player by their average Match Ranking Points using only
// played rows through (and including) maxEventId - lets us reconstruct
// what the Ranking Factor standings looked like as of a past event, since
// Match Entry only stores the final season-cumulative average on every row.
function getRanksThroughEvent(playedRows, maxEventId) {

  const totals = {}

  playedRows
    .filter((row) => Number(row["Event ID"]) <= maxEventId)
    .forEach((row) => {

      const name = row.Player.trim()

      if (!totals[name]) totals[name] = { sum: 0, count: 0 }

      totals[name].sum += parseFloat(row["Match Ranking Points"]) || 0
      totals[name].count += 1

    })

  const ranked = Object.entries(totals)
    .map(([name, t]) => ({ name, avg: t.sum / t.count }))
    .sort((a, b) => b.avg - a.avg)

  const rankByName = {}

  ranked.forEach((player, index) => {
    rankByName[player.name] = index + 1
  })

  return rankByName

}

// Ranks players who have played golf-style (ties share a position, shown
// as "T4", and the next player is 6th) and leaves the rest unranked.
function withRanks(players, value) {
  const played = players.filter((p) => p.eventsPlayed > 0).sort((a, b) => value(b) - value(a))
  const unplayed = players.filter((p) => !(p.eventsPlayed > 0))
  return [
    ...played.map((p) => {
      const position = played.findIndex((q) => value(q) === value(p)) + 1
      const tied = played.filter((q) => value(q) === value(p)).length > 1
      return { ...p, computedRank: position, tied }
    }),
    ...unplayed.map((p) => ({ ...p, computedRank: null, tied: false })),
  ]
}

const posLabel = (p) => (p.computedRank ? `${p.tied ? "T" : ""}${p.computedRank}` : "–")

const BOARDS = {
  horsewide: {
    label: "Horsewide",
    title: "Horsewide Standings",
    blurb: "Ranked by Ranking Factor - average ranking points per event.",
    statLabel: "Ranking Factor",
    statShort: "RF",
    value: (p) => p.avgRankingPoints,
    format: (v) => (Number.isFinite(v) ? v.toFixed(2) : "-"),
  },
  power: {
    label: "Power Points",
    title: "Power Points Standings",
    blurb: "Season-long total of placement points earned at every event.",
    statLabel: "Power Points",
    statShort: "PTS",
    value: (p) => p.totalPowerScore,
    format: (v) => (Number.isFinite(v) ? String(Math.round(v)) : "-"),
  },
}

function Cutout({ id, name }) {
  const [src, setSrc] = useState(cutoutUrl(id))
  return (
    <img
      className="lb2-podium-photo"
      src={src}
      alt={name}
      onError={() => setSrc(nextPlayerImage)}
    />
  )
}

function Movement({ value }) {
  if (value === null || value === undefined || value === 0) {
    return <span className="lb2-move is-flat" aria-label="No change">–</span>
  }
  return value > 0 ? (
    <span className="lb2-move is-up" aria-label={`Up ${value}`}>▲{value}</span>
  ) : (
    <span className="lb2-move is-down" aria-label={`Down ${Math.abs(value)}`}>▼{Math.abs(value)}</span>
  )
}

function Leaderboard() {

  const [players, setPlayers] = useState([])
  const [playerIds, setPlayerIds] = useState({})
  const [summaries, setSummaries] = useState({})
  const [matchEntry, setMatchEntry] = useState([])
  const [profiles, setProfiles] = useState({})
  const [board, setBoard] = useState("horsewide")
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {

    Promise.all([getPlayers(), getMatchEntry(), getEvents()]).then(([playerRows, entries, events]) => {

      const idsByName = {}

      playerRows.forEach((player) => {
        idsByName[player.Name] = player["Player ID"]
      })

      setPlayerIds(idsByName)
      setPlayers(playerRows)
      setMatchEntry(entries)
      setSummaries(getPlayerSummaries(entries))
      setProfiles(buildPlayerProfiles({ players: playerRows, matchEntry: entries, events, holeRows: [] }).profiles)

    })

  }, [])

  // Match Entry keeps a row for every player who ever appeared in a
  // matchup, even one that's since been removed from the Players sheet -
  // so only names still on that sheet are eligible to rank. Substitute
  // players (name tagged "(Sub)") fill in for someone else's match but
  // shouldn't earn a season ranking of their own, so they're excluded.
  const activeNames = new Set(players.map((player) => player.Name))

  const rankablePlayers = Object.entries(summaries)
    .filter(([name]) => activeNames.has(name))
    .filter(([name]) => !/\(sub\)/i.test(name))
    .map(([name, s]) => ({ name, ...s }))

  // Movement compares each player's current Ranking Factor rank against
  // where they ranked before the most recently played event. Only players
  // who actually played in that event get a movement value.
  const playedRows = matchEntry.filter((row) => row.Player && row.Contributions)

  const playedEventIds = [...new Set(playedRows.map((row) => Number(row["Event ID"])))]
    .sort((a, b) => a - b)

  const lastEventId = playedEventIds[playedEventIds.length - 1]
  const previousEventId = playedEventIds[playedEventIds.length - 2]

  const playedLastEvent = new Set(
    playedRows
      .filter((row) => Number(row["Event ID"]) === lastEventId)
      .map((row) => row.Player.trim())
  )

  const previousRanks = previousEventId !== undefined
    ? getRanksThroughEvent(playedRows, previousEventId)
    : {}

  const config = BOARDS[board]

  const ranked = withRanks(rankablePlayers, config.value).map((player) => {

    const previousRank = previousRanks[player.name]

    // Movement only applies to the Ranking Factor standings.
    const movement =
      board === "horsewide" && player.computedRank && previousRank !== undefined && playedLastEvent.has(player.name)
        ? previousRank - player.computedRank
        : null

    return { ...player, movement, profile: profiles[player.name] }

  })

  const leaderValue = ranked.length ? config.value(ranked[0]) : 0
  const podium = ranked.filter((p) => p.computedRank && p.computedRank <= 3)

  const lastName = (name) => name.split(" ").slice(-1)[0]

  return (

    <div className="lb2">

      <div className="lb2-head">
        <div>
          <span className="lb2-eyebrow">2026 Season · After {playedEventIds.length} event{playedEventIds.length === 1 ? "" : "s"}</span>
          <h2>{config.title}</h2>
          <p>{config.blurb}</p>
        </div>

        <div className="lb2-tabs" role="tablist" aria-label="Standings">
          {Object.entries(BOARDS).map(([key, b]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={board === key}
              className={board === key ? "active" : ""}
              onClick={() => {
                setBoard(key)
                setExpanded(null)
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {podium.length > 0 && (
        <div className="lb2-podium">
          {podium.map((p) => (
            <Link
              key={p.name}
              to={`/player-profile/${playerIds[p.name]}`}
              className={`lb2-podium-card is-pos-${p.computedRank}`}
            >
              <div className="lb2-podium-art">
                <span className="lb2-podium-rank">{posLabel(p)}</span>
                <Cutout id={playerIds[p.name]} name={p.name} />
              </div>
              <div className="lb2-podium-body">
                <strong>{p.name}</strong>
                <div className="lb2-podium-stat">
                  <b>{config.format(config.value(p))}</b>
                  <span>{config.statLabel}</span>
                </div>
                <span className="lb2-podium-gap">
                  {p.computedRank === 1 ? "Leader" : `${config.format(leaderValue - config.value(p))} behind`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="lb2-board">

        <div className="lb2-table" role="table" aria-label={config.title}>

          <div className="lb2-row lb2-row-head" role="row">
            <span role="columnheader">Pos</span>
            <span role="columnheader">Player</span>
            <span role="columnheader" className="lb2-col-stat">
              <span className="label-full">{config.statLabel}</span>
              <span className="label-short">{config.statShort}</span>
            </span>
            <span role="columnheader" className="lb2-col-opt">Behind</span>
            <span role="columnheader" className="lb2-col-opt">Events</span>
            <span role="columnheader">Wins</span>
            <span role="columnheader" className="lb2-col-opt">2nd</span>
            <span role="columnheader" className="lb2-col-opt">Top 3</span>
            <span role="columnheader" aria-label="Details" />
          </div>

          {ranked.map((player) => {

            const isOpen = expanded === player.name
            const recent = player.profile ? [...player.profile.results].reverse().slice(0, 4) : []
            const value = config.value(player)

            return (

              <Fragment key={player.name}>

                <button
                  type="button"
                  role="row"
                  aria-expanded={isOpen}
                  className={`lb2-row${player.computedRank && player.computedRank <= 3 ? " is-top" : ""}${isOpen ? " is-open" : ""}${!player.computedRank ? " is-unranked" : ""}`}
                  onClick={() => setExpanded(isOpen ? null : player.name)}
                >

                  <span className="lb2-pos" role="cell">
                    <b>{posLabel(player)}</b>
                    {board === "horsewide" && <Movement value={player.movement} />}
                  </span>

                  <span className="lb2-player" role="cell">
                    <img
                      src={headshotUrl(playerIds[player.name])}
                      alt=""
                      onError={playerImageFallback}
                    />
                    <span className="lb2-player-text">
                      <span className="lb2-name">
                        <span className="lb2-first">{player.name.split(" ").slice(0, -1).join(" ")}</span>{" "}
                        <strong>{lastName(player.name)}</strong>
                      </span>
                      <span className="lb2-flag"><UsaFlag width={14} /> USA</span>
                    </span>
                  </span>

                  <span className="lb2-stat lb2-col-stat" role="cell">{player.computedRank ? config.format(value) : "–"}</span>

                  <span className="lb2-col-opt lb2-muted" role="cell">
                    {!player.computedRank ? "–" : player.computedRank === 1 ? "–" : config.format(leaderValue - value)}
                  </span>

                  <span className="lb2-col-opt" role="cell">{player.eventsPlayed}</span>
                  <span role="cell">{player.wins}</span>
                  <span className="lb2-col-opt" role="cell">{player.runnerUps}</span>
                  <span className="lb2-col-opt" role="cell">{player.topThree}</span>

                  <span className="lb2-caret" role="cell" aria-hidden="true"><ChevronDownIcon size={18} /></span>

                </button>

                {isOpen && (
                  <div className="lb2-detail">
                    <div className="lb2-detail-stats">
                      <div><span>Events</span><b>{player.eventsPlayed}</b></div>
                      <div><span>2nd</span><b>{player.runnerUps}</b></div>
                      <div><span>Top 3</span><b>{player.topThree}</b></div>
                      <div><span>Behind</span><b>{player.computedRank && player.computedRank > 1 ? config.format(leaderValue - value) : "–"}</b></div>
                    </div>

                    {recent.length > 0 ? (
                      <div className="lb2-detail-results">
                        <span className="lb2-detail-title">Recent results</span>
                        <ul>
                          {recent.map((r) => (
                            <li key={r.eventId}>
                              <span className={`lb2-detail-pos${r.placement === 1 ? " is-win" : ""}`}>{r.placement ? ordinal(r.placement) : "-"}</span>
                              <span className="lb2-detail-event">{r.eventName}</span>
                              <span className="lb2-detail-pts">{r.rankingPoints.toFixed(2)} pts</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="lb2-detail-empty">No events played yet.</p>
                    )}

                    <Link to={`/player-profile/${playerIds[player.name]}`} className="lb2-detail-link">
                      View full profile →
                    </Link>
                  </div>
                )}

              </Fragment>

            )

          })}

        </div>

      </section>

      <p className="lb2-note">
        Movement shows how many spots a player moved in the Horsewide standings after the most
        recent event. Tap any player for their recent results.
      </p>

    </div>

  )

}

export default Leaderboard
