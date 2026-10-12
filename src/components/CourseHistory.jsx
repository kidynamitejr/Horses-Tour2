import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { getHoleByHole, getEvents } from "../data/googleSheets"
import { getCourseHistory, formatOverPar, HOLES } from "../utils/courseHistory"

// Mid-tone colors that stay readable on both the light and dark themes.
const TEAM_COLORS = ["#2f80ed", "#d9a400", "#27ae60", "#eb5757", "#9b51e0", "#f2994a", "#00acc1"]

// Evenly spaced whole-number ticks that always include even par, so the
// top of the axis doesn't end on an odd-sized gap.
function getYAxis(teams, field) {

  const values = [0, ...teams.flatMap((team) => team[field].filter((value) => value !== null))]

  const min = Math.min(...values)
  const max = Math.max(...values)

  const step = [1, 2, 5, 10, 20, 50].find((size) => (max - min) / size <= 8) || 50

  const lower = Math.floor(min / step) * step
  const upper = Math.ceil(max / step) * step

  const ticks = []

  for (let value = lower; value <= upper; value += step) ticks.push(value)

  return { domain: [lower, upper], ticks }

}

// `field` is "cumulative" (running total) or "scores" (each hole on its own).
function ScoreChart({ match, field, caption, tooltipLabel }) {

  const yAxis = getYAxis(match.teams, field)

  const data = HOLES.map((hole, index) => {

    const point = { hole }

    match.teams.forEach((team) => {
      point[team.letter] = team[field][index]
    })

    return point

  })

  return (

    <>

      <p className="course-chart-caption">{caption}</p>

      <div className="course-chart-wrap">

        <ResponsiveContainer width="100%" height={340}>

          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>

            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />

            <XAxis
              dataKey="hole"
              interval="equidistantPreserveStart"
              minTickGap={6}
              tick={{ fill: "currentColor", fontSize: 11 }}
              stroke="currentColor"
              strokeOpacity={0.4}
            />

            <YAxis
              allowDecimals={false}
              width={36}
              reversed
              interval={0}
              domain={yAxis.domain}
              ticks={yAxis.ticks}
              tickFormatter={(value) => formatOverPar(value)}
              tick={{ fill: "currentColor", fontSize: 11 }}
              stroke="currentColor"
              strokeOpacity={0.4}
            />

            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                color: "var(--chart-tooltip-fg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 11,
                lineHeight: 1.3,
              }}
              labelStyle={{ margin: 0, fontSize: 11 }}
              itemStyle={{ padding: 0, fontSize: 11 }}
              offset={16}
              wrapperStyle={{ pointerEvents: "none" }}
              labelFormatter={(hole) => `${tooltipLabel} ${hole}`}
              formatter={(value, name) => [formatOverPar(value), name]}
            />

            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="5 5" />

            {match.teams.map((team, index) => (
              <Line
                key={team.letter}
                type="monotone"
                dataKey={team.letter}
                name={team.name}
                stroke={TEAM_COLORS[index % TEAM_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}

          </LineChart>

        </ResponsiveContainer>

      </div>

    </>

  )

}

function MatchChart({ match, course }) {

  // Legend doubles as a mini results list: best round first.
  const legendTeams = match.teams
    .map((team, index) => ({ ...team, color: TEAM_COLORS[index % TEAM_COLORS.length] }))
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))

  return (

    <div className="course-match-body">

      <ScoreChart
        match={match}
        field="cumulative"
        caption="Running score over par after each hole"
        tooltipLabel="After hole"
      />

      <div className="course-legend">

        {legendTeams.map((team) => (

          <span className="course-legend-item" key={team.letter}>

            <span className="course-legend-swatch" style={{ background: team.color }} />

            {team.name}

            <span className="course-legend-score">
              {team.complete ? formatOverPar(team.total) : `thru ${team.holesPlayed}`}
            </span>

          </span>

        ))}

      </div>

      {course && (
        <>
          <h3 className="course-record-heading">Course Records</h3>
          <CourseRecords course={course} />
        </>
      )}

    </div>

  )

}

// The event name is only worth showing once a course has more than one
// match, otherwise it's just repeating the obvious.
function formatRecordTeams(teams, showEvent) {
  return teams.map((team) => `${team.name}${showEvent ? ` (${team.eventName})` : ""}`).join(" • ")
}

function CourseRecords({ course }) {

  const { hardest, easiest, bestRound, averageRound, mostUnderPar } = course

  const showEvent = course.matchCount > 1

  // A tie like "Holes 2, 10, 13 & 16" is too long for the big number size.
  const holeValueClass = (entry) => (entry && entry.holes.length > 1 ? "stat-value course-stat-long" : "stat-value")

  return (

    <div className="course-record-block">

      <h3 className="course-record-title">
        {course.course}

        <span className="course-record-sub">
          {course.matchCount} {course.matchCount === 1 ? "match" : "matches"} · {course.teamRoundCount} team rounds
        </span>
      </h3>

      <div className="stats-grid">

        <div className="stat-card">
          <h3>Most Challenging Hole</h3>
          <p className={holeValueClass(hardest)}>{hardest ? hardest.label : "-"}</p>
          <p className="stat-team">{hardest ? `${formatOverPar(hardest.average, 2)} avg over par` : ""}</p>
        </div>

        <div className="stat-card">
          <h3>Easiest Hole</h3>
          <p className={holeValueClass(easiest)}>{easiest ? easiest.label : "-"}</p>
          <p className="stat-team">{easiest ? `${formatOverPar(easiest.average, 2)} avg over par` : ""}</p>
        </div>

        <div className="stat-card">
          <h3>Best Team Round</h3>
          <p className="stat-value">{bestRound ? formatOverPar(bestRound.total) : "-"}</p>
          <p className="stat-team">{bestRound ? formatRecordTeams(bestRound.teams, showEvent) : ""}</p>
        </div>

        <div className="stat-card">
          <h3>Average Team Round</h3>
          <p className="stat-value">{averageRound !== null ? formatOverPar(averageRound, 1) : "-"}</p>
          <p className="stat-team">over par per team</p>
        </div>

        <div className="stat-card">
          <h3>Most Under-Par Holes</h3>
          <p className="stat-value">{mostUnderPar ? mostUnderPar.count : "-"}</p>
          <p className="stat-team">{mostUnderPar ? formatRecordTeams(mostUnderPar.teams, showEvent) : "in a single round"}</p>
        </div>

        <div className="stat-card">
          <h3>Team Rounds Recorded</h3>
          <p className="stat-value">{course.teamRoundCount}</p>
          <p className="stat-team">across {course.matchCount} {course.matchCount === 1 ? "match" : "matches"}</p>
        </div>

      </div>

    </div>

  )

}

function CourseHistory() {

  const [history, setHistory] = useState({ matches: [], courses: [] })
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState(null)

  useEffect(() => {

    async function loadHistory() {

      try {

        const [holeRows, events] = await Promise.all([getHoleByHole(), getEvents()])

        setHistory(getCourseHistory(holeRows, events))

      } catch (error) {

        console.error("Course History Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadHistory()

  }, [])

  const { matches, courses } = history

  return (

    <>

      <section className="card">

        <h2>Match History</h2>

        {loading && <p>Loading course history...</p>}

        {!loading && matches.length === 0 && (
          <p>No hole-by-hole scores have been entered yet.</p>
        )}

        <div className="course-match-list">

          {matches.map((match) => {

            const open = expandedKey === match.key

            return (

              <div className={`course-match${open ? " course-match-open" : ""}`} key={match.key}>

                <button
                  type="button"
                  className="course-match-header"
                  aria-expanded={open}
                  onClick={() => setExpandedKey(open ? null : match.key)}
                >

                  <span>

                    <span className="course-match-title">
                      {match.year} {match.eventName}
                    </span>

                    <span className="course-match-meta">
                      {[match.date, match.course].filter(Boolean).join(" • ")}
                    </span>

                  </span>

                  <span className="course-match-summary">

                    <span className="course-match-lowround">
                      {match.lowRound
                        ? `Low round ${formatOverPar(match.lowRound.total)} · ${match.lowRound.names.join(" • ")}`
                        : "Round in progress"}
                    </span>

                    <span className="course-match-chevron" aria-hidden="true">▾</span>

                  </span>

                </button>

                {open && <MatchChart match={match} course={courses.find((c) => c.course === (match.course || match.eventName))} />}

              </div>

            )

          })}

        </div>

      </section>

    </>

  )

}

export default CourseHistory
