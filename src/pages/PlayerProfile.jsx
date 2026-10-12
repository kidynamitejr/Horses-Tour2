import { useParams, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import {
  getPlayers,
  getSchedule,
  getMatchEntry,
  getEvents,
} from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { getPlayerWinnings, formatCurrency } from "../utils/winnings"
import { getMajorWins } from "../utils/majors"
import { getPlayerBadges } from "../utils/badges"
import TradingCardModal from "../components/TradingCardModal"

function PlayerProfile() {
  const { name } = useParams()

  const [player, setPlayer] = useState(null)
  const [summary, setSummary] = useState(null)
  const [pointsHistory, setPointsHistory] = useState([])
  const [roundStats, setRoundStats] = useState({
    highest: null,
    lowest: null,
    best: null,
    worst: null,
  })
  const [loading, setLoading] = useState(true)
  const [totalWinnings, setTotalWinnings] = useState(0)
  const [majorWins, setMajorWins] = useState(0)
  const [badges, setBadges] = useState(null)
  const [showTradingCard, setShowTradingCard] = useState(false)

  useEffect(() => {
    async function loadPlayer() {
      try {
        const players = await getPlayers()
        const schedule = await getSchedule()
        const matchEntry = await getMatchEntry()
        const events = await getEvents()

        const foundPlayer = players.find(
          (p) =>
            String(p["Player ID"]).trim() ===
            String(name).trim()
        )

        setPlayer(foundPlayer || null)

        if (foundPlayer) {

          const winningsByPlayer = getPlayerWinnings(events)

          setTotalWinnings(winningsByPlayer[foundPlayer.Name.trim()] || 0)

          const majorWinsByPlayer = getMajorWins(events)

          setMajorWins(majorWinsByPlayer[foundPlayer.Name.trim()] || 0)

          const badgesByPlayer = getPlayerBadges(matchEntry)

          setBadges(badgesByPlayer[foundPlayer.Name.trim()] || null)

          const summaries = getPlayerSummaries(matchEntry)
          const foundSummary = summaries[foundPlayer.Name] || null

          // Rank is computed live from Ranking Factor (AVG Ranking Points)
          // across every non-sub player, the same way the Horsewide
          // Leaderboard does, rather than trusting Match Entry's own
          // Current Rank column - that formula can be blank for players
          // who were added after it was last dragged down.
          const rankedPlayers = Object.entries(summaries)
            .filter(([n]) => !/\(sub\)/i.test(n))
            .map(([n, s]) => ({ name: n, ...s }))
            .filter((p) => p.eventsPlayed > 0)
            .sort((a, b) => b.avgRankingPoints - a.avgRankingPoints)

          const liveRankIndex = rankedPlayers.findIndex(
            (p) => p.name === foundPlayer.Name.trim()
          )

          setSummary(
            foundSummary
              ? { ...foundSummary, rank: liveRankIndex >= 0 ? liveRankIndex + 1 : null }
              : null
          )

          // Event names/dates come from the Schedule tab instead of Player
          // History, since Player History stopped being updated after the
          // first two events and is missing everything played since.
          const eventNameById = {}
          const eventDateById = {}

          schedule.forEach((e) => {
            eventNameById[e["Event ID"]] = e["Event Name"].trim()
            eventDateById[e["Event ID"]] = e.Date
          })

          // A played row is one with Contributions filled in - future/
          // unplayed event rows in Match Entry are dragged-down formula
          // rows with blanks there.
          const playedRows = matchEntry
            .filter(
              (row) =>
                row.Player &&
                row.Player.trim().toLowerCase() ===
                  foundPlayer.Name.trim().toLowerCase() &&
                row.Contributions
            )
            .sort((a, b) => Number(a["Event ID"]) - Number(b["Event ID"]))

          setPointsHistory(
            playedRows.map((row) => ({
              tournament: `${eventNameById[row["Event ID"]] || `Event ${row["Event ID"]}`} (${eventDateById[row["Event ID"]] || ""})`,
              points: parseFloat(row["Match Ranking Points"]) || 0,
            }))
          )

          const roundsWithPoints = playedRows
            .map((row) => ({
              eventId: row["Event ID"],
              points: parseFloat(row["Match Ranking Points"]),
            }))
            .filter((r) => !isNaN(r.points))

          if (roundsWithPoints.length > 0) {
            const best = roundsWithPoints.reduce((a, b) =>
              b.points > a.points ? b : a
            )

            const worst = roundsWithPoints.reduce((a, b) =>
              b.points < a.points ? b : a
            )

            setRoundStats({
              highest: best.points,
              lowest: worst.points,
              best: eventNameById[best.eventId] || null,
              worst: eventNameById[worst.eventId] || null,
            })
          } else {
            setRoundStats({ highest: null, lowest: null, best: null, worst: null })
          }
        }
      } catch (error) {
        console.error("Player Profile Error:", error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayer()
  }, [name])

  if (loading) {
    return <h2>Loading...</h2>
  }

  if (!player) {
    return <h2>Player not found.</h2>
  }

  return (
    <>
      <section className="player-profile-header">

        <div className="player-profile-actions">

          <div className="player-profile-action-buttons">

            <Link
              to={`/compare-players?a=${player["Player ID"]}`}
              className="player-profile-action-button"
            >
              ⇄ Compare Players
            </Link>

            <button
              type="button"
              className="player-profile-action-button"
              onClick={() => setShowTradingCard(true)}
            >
              🎴 Trading Card
            </button>

          </div>

          {badges && Object.values(badges).some((b) => b.earned) && (
            <div className="player-badge-list">
              {Object.values(badges)
                .filter((b) => b.earned)
                .map((b) => (
                  <div className="player-badge-row" key={b.label}>
                    <span className="player-badge-row-icon">{b.icon}</span>
                    <div>
                      <strong>{b.label}</strong>
                      <p>{b.detail}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

        </div>

        <div className="player-profile-avatar-ring">
          <img
            src={`${import.meta.env.BASE_URL}images/players/${player["Player ID"]}.jpg`}
            alt={player.Name}
            className="profile-image"
            onError={(e) => {
              e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
            }}
          />
        </div>

        <div className="player-profile-info">
          <p className="player-profile-eyebrow">Player Profile</p>

          <h1>{player.Name}</h1>

          <p className="player-profile-meta">Joined {player["Join Date"]}</p>

          <span
            className={`status-badge ${
              player.Active && player.Active.trim().toLowerCase() === "active"
                ? "status-played"
                : "status-planned"
            }`}
          >
            {player.Active}
          </span>
        </div>

        {/* Balances the avatar's width so player-profile-info lands
            dead-center in the banner instead of being pushed right by
            the avatar's width. */}
        <div className="player-profile-header-spacer" aria-hidden="true" />
      </section>

      <section className="card">
        <h2>Career Statistics</h2>

        <div className="stats-grid">
          <div className="stat-card stat-card-winnings">
            <h3>Career Winnings</h3>
            <p className="stat-value stat-value-money">{formatCurrency(totalWinnings)}</p>
          </div>

          <div className="stat-card">
            <h3>Rank</h3>
            <p className="stat-value">{summary?.rank ?? "-"}</p>
          </div>

          <div className="stat-card">
            <h3>Ranking Factor</h3>
            <p className="stat-value">{summary?.avgRankingPoints ?? "-"}</p>
          </div>

          <div className="stat-card">
            <h3>Events Played</h3>
            <p className="stat-value">{summary?.eventsPlayed ?? 0}</p>
          </div>

          <div className="stat-card stat-card-majors">
            <h3>Majors Won</h3>
            <p className="stat-value stat-value-major">{majorWins}</p>
          </div>

          <div className="stat-card">
            <h3>Wins</h3>
            <p className="stat-value">{summary?.wins ?? 0}</p>
          </div>

          <div className="stat-card">
            <h3>Runner Ups</h3>
            <p className="stat-value">{summary?.runnerUps ?? 0}</p>
          </div>

          <div className="stat-card">
            <h3>Top 3 Finishes</h3>
            <p className="stat-value">{summary?.topThree ?? 0}</p>
          </div>

          <div className="stat-card">
            <h3>Highest Round</h3>
            <p className="stat-value">{roundStats.highest !== null ? roundStats.highest.toFixed(2) : "-"}</p>
          </div>

          <div className="stat-card">
            <h3>Lowest Round</h3>
            <p className="stat-value">{roundStats.lowest !== null ? roundStats.lowest.toFixed(2) : "-"}</p>
          </div>

          <div className="stat-card">
            <h3>Best Tournament</h3>
            <p className="stat-value stat-value-text">{roundStats.best || "-"}</p>
          </div>

          <div className="stat-card">
            <h3>Worst Tournament</h3>
            <p className="stat-value stat-value-text">{roundStats.worst || "-"}</p>
          </div>
        </div>
      </section>

      {pointsHistory.length > 0 && (
        <section className="card player-chart-card">
          <h2>Points Scored Over Time</h2>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={pointsHistory}
              margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
            >
              <defs>
                <linearGradient id="playerChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8a94a3" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#8a94a3" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9ed" />

              <XAxis
                dataKey="tournament"
                angle={-25}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 12, fill: "#666" }}
              />

              <YAxis tick={{ fill: "#666" }} />

              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #eee",
                  boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                }}
              />

              <Line
                type="monotone"
                dataKey="points"
                name="Points Scored"
                stroke="#8a94a3"
                strokeWidth={2}
                dot={{ r: 4, fill: "#8a94a3", stroke: "#8a94a3", strokeWidth: 1 }}
                activeDot={{ r: 6 }}
                fill="url(#playerChartFill)"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {showTradingCard && (
        <TradingCardModal
          player={player}
          stats={{
            rank: summary?.rank ?? null,
            wins: summary?.wins ?? 0,
            majorWins,
            winnings: totalWinnings,
          }}
          onClose={() => setShowTradingCard(false)}
        />
      )}
    </>
  )
}

export default PlayerProfile