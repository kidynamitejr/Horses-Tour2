import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { getMatchEntry, getEvents, getPlayers } from "../data/googleSheets"
import { getPlayerSummaries } from "../utils/matchEntry"
import { getPlayerWinnings, formatCurrency } from "../utils/winnings"

function toChartData(summaries, field) {
  return Object.entries(summaries)
    .filter(([name]) => !/\(sub\)/i.test(name))
    .map(([name, s]) => ({ name, value: s[field] }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
}

// Maps a player name (case-insensitive) to the headshot image the rest of
// the site uses for them.
function buildAvatarUrl(name, playerIdByName) {
  const id = playerIdByName[name.trim().toLowerCase()]
  return id
    ? `${import.meta.env.BASE_URL}images/players/${id}.jpg`
    : `${import.meta.env.BASE_URL}images/players/default.jpg`
}

function toWinningsChartData(winningsByPlayer, playerIdByName) {
  return Object.entries(winningsByPlayer)
    .filter(([name]) => !/\(sub\)/i.test(name))
    .map(([name, value]) => ({
      name,
      value,
      avatarUrl: buildAvatarUrl(name, playerIdByName),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
}

// Renders a player's headshot as a small ringed circle floating above
// their bar. Recharts clones this with x/y/width (the bar's geometry) and
// index added on top of the `data` prop we pass in ourselves.
function WinningsAvatarLabel({ x, y, width, index, data }) {

  const entry = data && data[index]

  const [imgError, setImgError] = useState(false)

  if (!entry) return null

  const size = 34
  const cx = x + width / 2
  const cy = y - size / 2 - 10
  const clipId = `winnings-avatar-clip-${index}`

  const src = imgError
    ? `${import.meta.env.BASE_URL}images/players/default.jpg`
    : entry.avatarUrl

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={size / 2} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={size / 2 + 2} fill="#fff" stroke="#d9b64a" strokeWidth={2} />

      <image
        href={src}
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
        onError={() => setImgError(true)}
      />
    </g>
  )

}

function TourLeaderCharts() {

  const [winsData, setWinsData] = useState([])
  const [runnerUpsData, setRunnerUpsData] = useState([])
  const [topThreeData, setTopThreeData] = useState([])
  const [winningsData, setWinningsData] = useState([])

  useEffect(() => {

    // Wins/Runner Ups/Top 3 come from Match Entry (like the rest of the
    // site) instead of the old Match Results tab, which stopped being
    // updated after the first two events.
    getMatchEntry().then((data) => {

      const summaries = getPlayerSummaries(data)

      setWinsData(toChartData(summaries, "wins"))
      setRunnerUpsData(toChartData(summaries, "runnerUps"))
      setTopThreeData(toChartData(summaries, "topThree"))

    })

    // Winnings live on the Events tab (Winner + per-person payout),
    // not Match Entry. Players is only needed to look up each winner's
    // headshot for the chart labels.
    Promise.all([getEvents(), getPlayers()]).then(([events, players]) => {

      const playerIdByName = {}

      players.forEach((p) => {
        playerIdByName[p.Name.trim().toLowerCase()] = p["Player ID"]
      })

      setWinningsData(toWinningsChartData(getPlayerWinnings(events), playerIdByName))

    })

  }, [])

  return (

    <section className="card">

      <h2>
        Tour Leaders
      </h2>

      <div className="leaderboard-charts">

        <div className="leaderboard-chart-card">

          <h3>Wins</h3>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={winsData} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Wins" fill="#c9a227" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

        </div>

        <div className="leaderboard-chart-card">

          <h3>Runner Ups</h3>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={runnerUpsData} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Runner Ups" fill="#002140" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

        </div>

        <div className="leaderboard-chart-card">

          <h3>Top 3 Finishes</h3>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topThreeData} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Top 3 Finishes" fill="#2d6a4f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

        </div>

        <div className="leaderboard-chart-card">

          <h3>Career Winnings</h3>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={winningsData} margin={{ top: 50, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" name="Winnings" fill="#1f7a3f" radius={[6, 6, 0, 0]}>
                <LabelList content={<WinningsAvatarLabel data={winningsData} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

        </div>

      </div>

    </section>

  )

}

export default TourLeaderCharts
