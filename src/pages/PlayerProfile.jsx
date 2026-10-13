import { useParams, useSearchParams, Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

import {
  getPlayers,
  getMatchEntry,
  getEvents,
  getHoleByHole,
} from "../data/googleSheets"
import { buildPlayerProfiles, formatRank, formatToPar } from "../utils/playerProfile"
import { formatCurrency } from "../utils/winnings"
import { getPlayerBadges } from "../utils/badges"
import { ordinal } from "../utils/ordinal"
import TradingCardModal from "../components/TradingCardModal"
import CourseCrest from "../components/CourseCrest"
import {
  TrophyIcon,
  DollarIcon,
  FlagIcon,
  ChartIcon,
  TargetIcon,
  UsersIcon,
  ChevronRightIcon,
  SwapIcon,
  CardIcon,
  UsaFlag,
} from "../components/Icons"

const BASE = import.meta.env.BASE_URL

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "career", label: "Career" },
  { key: "results", label: "Results" },
  { key: "stats", label: "Stats" },
]

const pct = (v, digits = 1) => (v === null || v === undefined ? "-" : `${v.toFixed(digits)}%`)
const num = (v, digits = 2) => (v === null || v === undefined ? "-" : v.toFixed(digits))
const yearOf = (r) => (r.dateValue ? r.dateValue.getFullYear() : "")

function PlayerPhoto({ id, name, className }) {
  const [src, setSrc] = useState(`${BASE}images/players/cutouts/${id}.png`)
  return (
    <img
      className={className}
      src={src}
      alt={name}
      onError={() => setSrc(`${BASE}images/players/cutouts/default.png`)}
    />
  )
}

function Avatar({ id, name, size = 40 }) {
  return (
    <img
      className="pp-avatar"
      src={`${BASE}images/players/${id}.jpg`}
      alt={name}
      width={size}
      height={size}
      onError={(e) => {
        e.target.src = `${BASE}images/players/default.jpg`
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function ProfileHero({ profile, season, onTradingCard, heroRef }) {
  const parts = profile.name.split(" ")
  const last = parts.length > 1 ? parts.pop() : ""
  const first = parts.join(" ")
  const thisSeason = profile.seasons[season] || { wins: 0, topThree: 0 }

  return (
    <section className="pp-hero" ref={heroRef}>
      <div className="pp-hero-photo">
        <PlayerPhoto id={profile.id} name={profile.name} className="pp-hero-cutout" />
      </div>

      <div className="pp-hero-body">
        <div className="pp-hero-top">
          <h1>
            <span>{first}</span>
            {last && <span>{last}</span>}
          </h1>

          {profile.homeCourse && (
            <div className="pp-hero-club">
              <span>{profile.homeCourse}</span>
              <CourseCrest course={profile.homeCourse} size={46} />
            </div>
          )}
        </div>

        <dl className="pp-facts">
          <div>
            <dt>Country</dt>
            <dd><UsaFlag width={18} /> USA</dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{profile.age ?? "-"}</dd>
          </div>
          <div>
            <dt>Turned Pro</dt>
            <dd>{profile.joinDate || "-"}</dd>
          </div>
          <div>
            <dt>Born</dt>
            <dd>{profile.bornText || "-"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{profile.active || "-"}</dd>
          </div>
        </dl>

        <dl className="pp-numbers">
          <div>
            <dt>Tour Wins</dt>
            <dd>{profile.career.wins}</dd>
          </div>
          <div>
            <dt>Wins ({season})</dt>
            <dd>{thisSeason.wins}</dd>
          </div>
          <div>
            <dt>Top 3 ({season})</dt>
            <dd>{thisSeason.topThree}</dd>
          </div>
          <div>
            <dt>Majors</dt>
            <dd>{profile.career.majors}</dd>
          </div>
          <div>
            <dt>Power Points</dt>
            <dd>{Math.round(profile.career.powerPoints)}</dd>
          </div>
          <div>
            <dt>Tour Rank</dt>
            <dd>{profile.tourRank ? profile.tourRank.position : "-"}</dd>
          </div>
        </dl>

        <div className="pp-tools">
          <span>Tools</span>
          <Link to={`/compare-players?a=${profile.id}`} className="pp-tool">
            <SwapIcon size={16} /> Compare Players
          </Link>
          <button type="button" className="pp-tool" onClick={onTradingCard}>
            <CardIcon size={16} /> Trading Card
          </button>
        </div>
      </div>
    </section>
  )
}

function ProfileTabs({ profile, tab, setTab, compact }) {
  return (
    <nav className={`pp-tabs${compact ? " is-compact" : ""}`} aria-label="Player profile sections">
      <div className="pp-tabs-identity" aria-hidden={!compact}>
        <Avatar id={profile.id} name={profile.name} size={34} />
        <div>
          <strong>{profile.name}</strong>
          <span><UsaFlag width={14} /> USA</span>
        </div>
      </div>

      <div className="pp-tabs-list" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

function SummaryCard({ title, subtitle, rows, onOpen }) {
  return (
    <button type="button" className="pp-summary" onClick={onOpen}>
      <div className="pp-summary-head">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <ChevronRightIcon size={18} />
      </div>

      <ul>
        {rows.map(({ icon: RowIcon, value, label }) => (
          <li key={label}>
            <span className="pp-summary-icon"><RowIcon size={16} /></span>
            <span>
              <b>{value}</b>
              <small>{label}</small>
            </span>
          </li>
        ))}
      </ul>
    </button>
  )
}

function BigNumbers({ items }) {
  return (
    <dl className="pp-big-numbers">
      {items.map(({ label, value, note }) => (
        <div key={label}>
          <dd>{value}</dd>
          <dt>{label}</dt>
          {note && <span>{note}</span>}
        </div>
      ))}
    </dl>
  )
}

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`pp-panel ${className}`}>
      {(title || action) && (
        <header className="pp-panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

function EmptyState({ name }) {
  return (
    <Panel>
      <p className="pp-empty">{name} hasn&apos;t played a Horses Tour event yet. Check back after the next event.</p>
    </Panel>
  )
}

function placeLabel(r) {
  return r.placement ? ordinal(r.placement) : "-"
}

/* ------------------------------------------------------------------ */
/* Overview                                                           */
/* ------------------------------------------------------------------ */

function PointsChart({ results }) {
  const data = results.map((r) => ({
    label: r.eventName.replace(/\s+(Open|Classic|Shootout|Cup|Challenge|Championship)$/i, ""),
    eventName: r.eventName,
    points: Math.round(r.rankingPoints * 100) / 100,
  }))

  const average = data.reduce((sum, d) => sum + d.points, 0) / (data.length || 1)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 64, left: -12, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "currentColor", strokeOpacity: 0.25 }}
          tick={{ fill: "currentColor", fontSize: 12 }}
          interval={0}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "currentColor", fontSize: 12 }}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          formatter={(value) => [value.toFixed(2), "Ranking points"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.eventName || ""}
          contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
        />
        <Bar dataKey="points" fill="#0b3157" className="pp-chart-bar" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />

        {/* Dotted line at the player's average points per event */}
        <ReferenceLine
          y={average}
          stroke="#c9a227"
          strokeWidth={2}
          strokeDasharray="6 5"
          ifOverflow="extendDomain"
          label={{
            value: `Avg ${average.toFixed(2)}`,
            position: "right",
            fill: "currentColor",
            fontSize: 12,
            fontWeight: 700,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function OverviewTab({ profile, season, setTab, fieldSize }) {
  const s = profile.seasons[season] || profile.career
  const h = profile.holeStats

  if (profile.results.length === 0) return <EmptyState name={profile.name} />

  const recent = [...profile.results].reverse().slice(0, 3)

  return (
    <>
      <div className="pp-summary-grid">
        <SummaryCard
          title="Career"
          subtitle="Horses Tour"
          onOpen={() => setTab("career")}
          rows={[
            { icon: TrophyIcon, value: profile.career.wins, label: "Wins" },
            { icon: DollarIcon, value: formatCurrency(profile.career.winnings), label: "Earnings" },
            { icon: TargetIcon, value: `${profile.career.topThree}/${profile.career.events}`, label: "Top 3 Finishes" },
          ]}
        />
        <SummaryCard
          title="Season"
          subtitle={String(season)}
          onOpen={() => setTab("results")}
          rows={[
            { icon: TrophyIcon, value: s.wins, label: "Wins" },
            { icon: TargetIcon, value: s.topThree, label: "Top 3" },
            { icon: FlagIcon, value: `${s.events}`, label: "Events Played" },
          ]}
        />
        <SummaryCard
          title="Standings"
          subtitle="Horsewide"
          onOpen={() => setTab("stats")}
          rows={[
            { icon: ChartIcon, value: profile.tourRank ? `${formatRank(profile.tourRank)} of ${fieldSize}` : "-", label: "Tour Rank" },
            { icon: TargetIcon, value: num(profile.averages.rankingFactor), label: "Ranking Factor" },
            { icon: FlagIcon, value: Math.round(profile.career.powerPoints), label: "Power Points" },
          ]}
        />
        <SummaryCard
          title="Stats"
          subtitle="Performance"
          onOpen={() => setTab("stats")}
          rows={[
            { icon: UsersIcon, value: formatRank(profile.ranks?.contribution), label: "Avg Contribution" },
            { icon: ChartIcon, value: formatRank(profile.ranks?.finish), label: "Avg Finish" },
            { icon: FlagIcon, value: h ? formatRank(profile.ranks?.birdiesPerRound) : "-", label: "Birdies / Round" },
          ]}
        />
      </div>

      <div className="pp-two-col">
        <Panel title="Ranking Points by Event" className="pp-chart-panel">
          <PointsChart results={profile.results} />
        </Panel>

        <Panel
          title="Recent Results"
          action={
            <button type="button" className="pp-link" onClick={() => setTab("results")}>
              All results <ChevronRightIcon size={16} />
            </button>
          }
        >
          <ul className="pp-recent">
            {recent.map((r) => (
              <li key={r.eventId}>
                <span className={`pp-pos${r.placement === 1 ? " is-win" : ""}`}>{placeLabel(r)}</span>
                <div>
                  <strong>{r.eventName}</strong>
                  <span>{r.date} · with {r.partners.join(" & ") || "—"}</span>
                </div>
                <b>{num(r.rankingPoints)}<small>pts</small></b>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Career                                                             */
/* ------------------------------------------------------------------ */

function CareerTab({ profile, badges }) {
  if (profile.results.length === 0) return <EmptyState name={profile.name} />

  const c = profile.career
  const earned = badges ? Object.values(badges).filter((b) => b.earned) : []

  const winsByYear = {}
  profile.wins.forEach((w) => {
    const y = yearOf(w)
    if (!winsByYear[y]) winsByYear[y] = []
    winsByYear[y].push(w)
  })

  return (
    <>
      {earned.length > 0 && (
        <Panel title="Achievements">
          <div className="pp-badges">
            {earned.map((b) => (
              <div className="pp-badge" key={b.label} title={b.detail}>
                <span>{b.icon}</span>
                <div>
                  <strong>{b.label}</strong>
                  <small>{b.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="pp-stat-boxes">
        <div className="pp-stat-box">
          <h3>Starts</h3>
          <div>
            <p><b>{c.events}</b><span>Events</span></p>
            <p><b>{c.topThree}/{c.events}</b><span>Top 3</span></p>
          </div>
        </div>
        <div className="pp-stat-box">
          <h3>Wins</h3>
          <div>
            <p><b>{c.wins}</b><span>On Tour</span></p>
            <p><b>{c.majors}</b><span>Majors</span></p>
          </div>
        </div>
        <div className="pp-stat-box">
          <h3>Earnings</h3>
          <div>
            <p><b>{formatCurrency(c.winnings)}</b><span>Official Money</span></p>
          </div>
        </div>
        <div className="pp-stat-box">
          <h3>Joined Tour</h3>
          <div>
            <p><b>{profile.joinDate || "-"}</b><span>Tour Card</span></p>
          </div>
        </div>
      </div>

      <Panel title="Finishes">
        <BigNumbers
          items={[
            { label: "Wins", value: c.wins },
            { label: "2nd", value: c.runnerUps },
            { label: "3rd", value: c.thirds },
            { label: "Top 3", value: c.topThree },
            { label: "Avg Finish", value: num(profile.averages.finish, 1) },
            { label: "Events", value: c.events },
          ]}
        />
      </Panel>

      <Panel title="Snapshot">
        <div className="pp-snapshot">
          <div>
            <h3>Last Win</h3>
            {profile.lastWin ? (
              <>
                <strong>{profile.lastWin.eventName}</strong>
                <span>{yearOf(profile.lastWin)}</span>
                <small>{profile.lastWin.course}</small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div>
            <h3>Lowest Team Round</h3>
            {profile.lowestRound ? (
              <>
                <strong>{formatToPar(profile.lowestRound.teamScore)}</strong>
                <span>{profile.lowestRound.eventName} ({yearOf(profile.lowestRound)})</span>
                <small>{profile.lowestRound.course}</small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div>
            <h3>Best Points Finish</h3>
            {profile.bestPointsEvent ? (
              <>
                <strong>{num(profile.bestPointsEvent.rankingPoints)}</strong>
                <span>{profile.bestPointsEvent.eventName}</span>
                <small>{ordinal(profile.bestPointsEvent.placement)} place</small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={<>Horses Tour Wins <span className="pp-count">{c.wins}</span></>}>
        {profile.wins.length === 0 ? (
          <p className="pp-empty">No wins yet.</p>
        ) : (
          Object.entries(winsByYear)
            .sort((a, b) => b[0] - a[0])
            .map(([year, wins]) => (
              <div className="pp-wins-year" key={year}>
                <h3>{year} <span className="pp-count">{wins.length}</span></h3>
                <ul>
                  {wins.map((w) => (
                    <li key={w.eventId}>
                      <strong>{year} {w.eventName}</strong>
                      {w.isMajor && <span className="pp-major-tag">★ {w.type}</span>}
                      <span className="pp-wins-meta">
                        {w.course} · with {w.partners.join(" & ") || "—"} · {formatToPar(w.teamScore)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </Panel>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Results                                                            */
/* ------------------------------------------------------------------ */

function ResultsTab({ profile, season, playerIds }) {
  if (profile.results.length === 0) return <EmptyState name={profile.name} />

  const s = profile.seasons[season] || profile.career
  const rows = profile.results.filter((r) => yearOf(r) === Number(season))

  return (
    <>
      <div className="pp-season-bar">
        <div>
          <span>Tour</span>
          <strong>Horses Tour</strong>
        </div>
        <div>
          <span>Season</span>
          <strong>{season}</strong>
        </div>
      </div>

      <div className="pp-stat-boxes pp-stat-boxes-2">
        <div className="pp-stat-box">
          <h3>Starts</h3>
          <div>
            <p><b>{s.events}</b><span>Events</span></p>
            <p><b>{s.topThree}/{s.events}</b><span>Top 3</span></p>
          </div>
        </div>
        <div className="pp-stat-box">
          <h3>Earnings</h3>
          <div>
            <p><b>{formatCurrency(s.winnings)}</b><span>Official Money</span></p>
          </div>
        </div>
      </div>

      <Panel title="Finishes">
        <BigNumbers
          items={[
            { label: "Wins", value: s.wins },
            { label: "2nd", value: s.runnerUps },
            { label: "3rd", value: s.thirds },
            { label: "Top 3", value: s.topThree },
            { label: "Ranking Pts", value: num(s.rankingPoints) },
            { label: "Power Pts", value: Math.round(s.powerPoints) },
          ]}
        />
      </Panel>

      <Panel title="Results & Scorecards" className="pp-results-panel">
        <div className="table-scroll">
          <table className="pp-results-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tournament</th>
                <th>Pos</th>
                <th>Partner</th>
                <th>Team</th>
                <th>
                  <span className="label-full">Contribution</span>
                  <span className="label-short">Contr.</span>
                </th>
                <th>
                  <span className="label-full">Rank Pts</span>
                  <span className="label-short">Pts</span>
                </th>
                <th className="hide-on-phone">Power Pts</th>
                <th>
                  <span className="label-full">Winnings</span>
                  <span className="label-short">$</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.eventId}>
                  <td className="pp-nowrap">{r.date}</td>
                  <td className="pp-results-event">
                    <strong>{r.eventName}</strong>
                    {r.isMajor && <span className="pp-major-tag">★ {r.type}</span>}
                    <small>{r.course}</small>
                  </td>
                  <td>
                    <span className={`pp-pos${r.placement === 1 ? " is-win" : ""}`}>{placeLabel(r)}</span>
                  </td>
                  <td>
                    {r.partners.map((p) => (
                      playerIds[p.toLowerCase()] ? (
                        <Link key={p} to={`/player-profile/${playerIds[p.toLowerCase()]}`} className="pp-partner">{p}</Link>
                      ) : (
                        <span key={p} className="pp-partner">{p}</span>
                      )
                    ))}
                  </td>
                  <td>{formatToPar(r.teamScore)}</td>
                  <td>{pct(r.contribution)}</td>
                  <td><b>{num(r.rankingPoints)}</b></td>
                  <td className="hide-on-phone">{r.powerPoints}</td>
                  <td>{r.winnings ? formatCurrency(r.winnings) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Stats                                                              */
/* ------------------------------------------------------------------ */

function getStatRows(profile, tourAverages) {
  const a = profile.averages
  const c = profile.career
  const h = profile.holeStats
  const r = profile.ranks || {}
  const t = tourAverages

  return [
    {
      group: "Points",
      key: "rankingFactor",
      label: "Ranking Factor",
      value: num(a.rankingFactor),
      tour: num(t.rankingFactor),
      support: ["Events", c.events],
    },
    {
      group: "Points",
      key: "rankingPoints",
      label: "Total Ranking Points",
      value: num(c.rankingPoints),
      tour: num(t.rankingPoints),
      support: ["Best Event", profile.bestPointsEvent ? num(profile.bestPointsEvent.rankingPoints) : "-"],
    },
    {
      group: "Points",
      key: "powerPoints",
      label: "Power Points",
      value: Math.round(c.powerPoints),
      tour: num(t.powerPoints, 1),
      support: ["Per Event", num(a.powerPoints, 1)],
    },
    {
      group: "Teamwork",
      key: "contribution",
      label: "Avg Contribution",
      value: pct(a.contribution),
      tour: pct(t.contribution),
      support: ["Best", pct(Math.max(...profile.results.map((x) => x.contribution ?? 0)))],
    },
    {
      group: "Teamwork",
      key: "finish",
      label: "Avg Finish",
      value: num(a.finish, 1),
      tour: num(t.finish, 1),
      support: ["Best", ordinal(Math.min(...profile.results.map((x) => x.placement || 99)))],
    },
    {
      group: "Teamwork",
      key: "teamScore",
      label: "Avg Team Score",
      value: formatToPar(a.teamScore),
      tour: formatToPar(t.teamScore),
      support: ["Lowest", profile.lowestRound ? formatToPar(profile.lowestRound.teamScore) : "-"],
    },
    {
      group: "Scoring",
      key: "birdiesPerRound",
      label: "Birdies per Round",
      value: h ? num(h.birdiesPerRound) : "-",
      tour: num(t.birdiesPerRound),
      support: ["Total Birdies", h ? h.birdies : "-"],
    },
    {
      group: "Scoring",
      key: "parOrBetterPct",
      label: "Par or Better %",
      value: h ? pct(h.parOrBetterPct) : "-",
      tour: pct(t.parOrBetterPct),
      support: ["Holes", h ? h.holes : "-"],
    },
    {
      group: "Scoring",
      key: "bogeysPerRound",
      label: "Bogeys per Round",
      value: h ? num(h.bogeysPerRound) : "-",
      tour: num(t.bogeysPerRound),
      support: ["Bogeys / Doubles+", h ? `${h.bogeys} / ${h.doubles}` : "-"],
    },
    {
      group: "Scoring",
      key: "roundAvg",
      label: "Scoring Average",
      value: h ? formatToPar(h.roundAvg) : "-",
      tour: formatToPar(t.roundAvg),
      support: ["Measured Rounds", h ? h.rounds : "-"],
    },
    {
      group: "Scoring",
      key: "frontNineAvg",
      label: "Front 9 Average",
      value: h ? formatToPar(h.frontNineAvg) : "-",
      tour: formatToPar(t.frontNineAvg),
      support: ["Measured Rounds", h ? h.rounds : "-"],
    },
    {
      group: "Scoring",
      key: "backNineAvg",
      label: "Back 9 Average",
      value: h ? formatToPar(h.backNineAvg) : "-",
      tour: formatToPar(t.backNineAvg),
      support: ["Measured Rounds", h ? h.rounds : "-"],
    },
    {
      group: "Money",
      key: "winnings",
      label: "Official Money",
      value: formatCurrency(c.winnings),
      tour: formatCurrency(Math.round(t.winnings || 0)),
      support: ["Wins", c.wins],
    },
  ].map((row) => ({ ...row, rank: r[row.key] }))
}

const STAT_GROUPS = ["All", "Points", "Teamwork", "Scoring", "Money"]

function StatsTab({ profile, tourAverages, fieldSize }) {
  const [group, setGroup] = useState("All")

  if (profile.results.length === 0) return <EmptyState name={profile.name} />

  const rows = getStatRows(profile, tourAverages)
  const shown = rows.filter((row) => group === "All" || row.group === group)

  return (
    <>
      <div className="pp-season-bar">
        <div>
          <span>Tour</span>
          <strong>Horses Tour</strong>
        </div>
        <div>
          <span>Ranked against</span>
          <strong>{fieldSize} players</strong>
        </div>
      </div>

      <Panel title="Stat Rankings">
        <div className="pp-chips" role="tablist">
          {STAT_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              className={group === g ? "active" : ""}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="pp-rank-cards">
          {shown.map((row) => (
            <div className="pp-rank-card" key={row.key}>
              <h3>{row.label}</h3>
              <strong>{formatRank(row.rank)}</strong>
              <b>{row.value}</b>
              <span>Tour avg {row.tour}</span>
            </div>
          ))}
        </div>

        {!profile.holeStats && (group === "All" || group === "Scoring") && (
          <p className="pp-note">
            Scoring stats come from the Hole by Hole sheet - none of {profile.name}&apos;s rounds have hole scores entered yet.
          </p>
        )}
      </Panel>

      <Panel title="All Stats" className="pp-results-panel">
        <div className="table-scroll">
          <table className="pp-stats-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Value</th>
                <th>Rank</th>
                <th className="hide-on-phone">Supporting Stat</th>
                <th className="hide-on-phone">Value</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key}>
                  <td className="pp-stats-name">{row.label}</td>
                  <td><b>{row.value}</b></td>
                  <td>{formatRank(row.rank)}</td>
                  <td className="hide-on-phone">{row.support[0]}</td>
                  <td className="hide-on-phone">{row.support[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function PlayerProfile() {
  const { name } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "overview"

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTradingCard, setShowTradingCard] = useState(false)
  const [compactTabs, setCompactTabs] = useState(false)
  const heroRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [players, matchEntry, events, holeRows] = await Promise.all([
          getPlayers(),
          getMatchEntry(),
          getEvents(),
          getHoleByHole(),
        ])

        const built = buildPlayerProfiles({ players, matchEntry, events, holeRows })

        const playerIds = {}
        players.forEach((p) => {
          playerIds[(p.Name || "").trim().toLowerCase()] = p["Player ID"]
        })

        setData({ ...built, playerIds, badges: getPlayerBadges(matchEntry) })
      } catch (error) {
        console.error("Player Profile Error:", error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Show the player's name in the tab bar once the big header scrolls away.
  useEffect(() => {
    const el = heroRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setCompactTabs(!entry.isIntersecting),
      { rootMargin: "-90px 0px 0px 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [data, name])

  if (loading) {
    return <p className="pp-loading">Loading player...</p>
  }

  const profile = data && Object.values(data.profiles).find(
    (p) => String(p.id).trim() === String(name).trim()
  )

  if (!profile) {
    return <h2>Player not found.</h2>
  }

  const seasons = Object.keys(profile.seasons).filter((y) => y !== "Unknown").sort()
  const season = seasons.length ? Number(seasons[seasons.length - 1]) : new Date().getFullYear()

  const setTab = (key) => {
    setSearchParams(key === "overview" ? {} : { tab: key }, { replace: true })
  }

  return (
    <div className="pp">
      <ProfileHero
        profile={profile}
        season={season}
        heroRef={heroRef}
        onTradingCard={() => setShowTradingCard(true)}
      />

      <ProfileTabs profile={profile} tab={tab} setTab={setTab} compact={compactTabs} />

      <div className="pp-content" role="tabpanel">
        {tab === "overview" && (
          <OverviewTab profile={profile} season={season} setTab={setTab} fieldSize={data.fieldSize} />
        )}
        {tab === "career" && (
          <CareerTab profile={profile} badges={data.badges[profile.name]} />
        )}
        {tab === "results" && (
          <ResultsTab profile={profile} season={season} playerIds={data.playerIds} />
        )}
        {tab === "stats" && (
          <StatsTab profile={profile} tourAverages={data.tourAverages} fieldSize={data.fieldSize} />
        )}
      </div>

      {showTradingCard && (
        <TradingCardModal
          profile={profile}
          onClose={() => setShowTradingCard(false)}
        />
      )}
    </div>
  )
}

export default PlayerProfile
