import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getMatchEntry, getEvents, getPlayers } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { getPlayerWinnings, formatCurrency } from "../utils/winnings"

const MAX_ROWS = 8

// One ranked list per stat: sorted biggest first, players with 0 left out.
function toRows(entries, playerByName) {
  return entries
    .filter(([name, value]) => !/\(sub\)/i.test(name) && value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      id: playerByName[name.trim().toLowerCase()],
    }))
}

// Golf-style ranking: ties share a position shown as "T2", the next player
// is 4th.
function withRanks(rows) {
  return rows.map((row) => {
    const position = rows.findIndex((r) => r.value === row.value) + 1
    const tied = rows.filter((r) => r.value === row.value).length > 1
    return { ...row, rank: `${tied ? "T" : ""}${position}` }
  })
}

function LeaderChart({ title, subtitle, rows, format = (v) => v, accent }) {
  const ranked = withRanks(rows).slice(0, MAX_ROWS)
  const max = ranked.length ? ranked[0].value : 0

  // Gridlines at even fractions of the leader's value give the bars a
  // quiet scale to sit on without a full axis.
  const ticks = [0.25, 0.5, 0.75]

  return (
    <figure className={`leader-chart leader-chart-${accent}`}>
      <figcaption className="leader-chart-head">
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </figcaption>

      {ranked.length === 0 ? (
        <p className="leader-chart-empty">No results yet.</p>
      ) : (
        <ol className="leader-chart-list">
          {ranked.map((row) => (
            <li
              key={row.name}
              className={row.value === max ? "is-leader" : ""}
              title={`${row.name}: ${format(row.value)}`}
            >
              <span className="leader-chart-rank">{row.rank}</span>

              <Link
                to={row.id ? `/player-profile/${row.id}` : "/players"}
                className="leader-chart-player"
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/players/${row.id || "default"}.jpg`}
                  alt=""
                  onError={(e) => {
                    e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
                  }}
                />
                <span>{row.name}</span>
              </Link>

              <div className="leader-chart-track" aria-hidden="true">
                {ticks.map((t) => (
                  <i key={t} style={{ left: `${t * 100}%` }} />
                ))}
                <div
                  className="leader-chart-bar"
                  style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
                />
              </div>

              <span className="leader-chart-value">{format(row.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}

function TourLeaderCharts() {

  const [charts, setCharts] = useState(null)

  useEffect(() => {

    // Wins/Runner Ups/Top 3 come from Match Entry (like the rest of the
    // site); winnings come from the Events tab (Winner + per-person payout).
    Promise.all([getMatchEntry(), getEvents(), getPlayers()]).then(([matchEntry, events, players]) => {

      const playerByName = {}

      players.forEach((p) => {
        playerByName[p.Name.trim().toLowerCase()] = p["Player ID"]
      })

      const summaries = Object.entries(getPlayerSummaries(matchEntry))
      const pick = (field) => summaries.map(([name, s]) => [name, s[field]])

      setCharts({
        wins: toRows(pick("wins"), playerByName),
        runnerUps: toRows(pick("runnerUps"), playerByName),
        topThree: toRows(pick("topThree"), playerByName),
        winnings: toRows(Object.entries(getPlayerWinnings(events)), playerByName),
      })

    })

  }, [])

  return (

    <section className="card">

      <h2>
        Tour Leaders
      </h2>

      {!charts ? (
        <p>Loading...</p>
      ) : (
        <div className="leader-charts">

          <LeaderChart title="Wins" subtitle="Season" rows={charts.wins} accent="gold" />

          <LeaderChart title="Career Winnings" subtitle="Official money" rows={charts.winnings} format={formatCurrency} accent="green" />

          <LeaderChart title="Top 3 Finishes" subtitle="Season" rows={charts.topThree} accent="navy" />

          <LeaderChart title="Runner Ups" subtitle="Season" rows={charts.runnerUps} accent="sky" />

        </div>
      )}

    </section>

  )

}

export default TourLeaderCharts
