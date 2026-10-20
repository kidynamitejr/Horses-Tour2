import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { getPlayers, getMatchEntry, getEvents, getHoleByHole } from "../data/googleSheets"
import { buildPlayerProfiles, formatToPar } from "../utils/playerProfile"
import { formatCurrency } from "../utils/winnings"
import { ordinal } from "../utils/ordinal"
import CourseCrest from "./CourseCrest"
import { SwapIcon, UsaFlag, ChevronDownIcon } from "./Icons"

const BASE = import.meta.env.BASE_URL

const num = (digits) => (v) => (v === null || v === undefined ? "-" : v.toFixed(digits))
const pct = (v) => (v === null || v === undefined ? "-" : `${v.toFixed(1)}%`)
const int = (v) => (v === null || v === undefined ? "-" : String(Math.round(v)))

// Every stat compared, grouped into sections. `better` says which
// direction wins ("high" or "low").
const SECTIONS = [
  {
    title: "Overview",
    stats: [
      { label: "Ranking Factor", get: (p) => p.averages.rankingFactor, better: "high", format: num(2) },
      { label: "Events Played", get: (p) => p.career.events, better: "high", format: int },
      { label: "Wins", get: (p) => p.career.wins, better: "high", format: int },
      { label: "Majors", get: (p) => p.career.majors, better: "high", format: int },
      { label: "Runner Ups", get: (p) => p.career.runnerUps, better: "high", format: int },
      { label: "Top 3 Finishes", get: (p) => p.career.topThree, better: "high", format: int },
      { label: "Average Finish", get: (p) => p.averages.finish, better: "low", format: num(1) },
    ],
  },
  {
    title: "Points",
    stats: [
      { label: "Power Points", get: (p) => p.career.powerPoints, better: "high", format: int },
      { label: "Best Event Points", get: (p) => p.bestPointsEvent?.rankingPoints ?? null, better: "high", format: num(2) },
    ],
  },
  {
    title: "Teamwork",
    stats: [
      { label: "Avg Contribution", get: (p) => p.averages.contribution, better: "high", format: pct },
      { label: "Avg Team Score", get: (p) => p.averages.teamScore, better: "low", format: formatToPar },
      { label: "Lowest Team Round", get: (p) => p.lowestRound?.teamScore ?? null, better: "low", format: formatToPar },
    ],
  },
  {
    title: "Scoring",
    note: "From hole-by-hole scores",
    stats: [
      { label: "Birdies per Round", get: (p) => p.holeStats?.birdiesPerRound ?? null, better: "high", format: num(2) },
      { label: "Par or Better %", get: (p) => p.holeStats?.parOrBetterPct ?? null, better: "high", format: pct },
      { label: "Bogeys per Round", get: (p) => p.holeStats?.bogeysPerRound ?? null, better: "low", format: num(2) },
    ],
  },
  {
    title: "Money",
    stats: [
      { label: "Official Money", get: (p) => p.career.winnings, better: "high", format: formatCurrency },
    ],
  },
]

function compareStat(stat, a, b) {
  const av = a ? stat.get(a) : null
  const bv = b ? stat.get(b) : null
  const valid = (v) => v !== null && v !== undefined && !isNaN(v)

  let winner = null
  if (valid(av) && valid(bv) && av !== bv) {
    winner = stat.better === "high" ? (av > bv ? "a" : "b") : (av < bv ? "a" : "b")
  }

  // Bar lengths: the better value fills its side; the other is scaled
  // relative to it. Lower-is-better stats are inverted so the leader
  // still has the longer bar.
  let aw = 0
  let bw = 0
  if (valid(av) && valid(bv)) {
    if (stat.better === "high") {
      const max = Math.max(av, bv)
      aw = max > 0 ? av / max : 0
      bw = max > 0 ? bv / max : 0
    } else if (av > 0 && bv > 0) {
      const min = Math.min(av, bv)
      aw = min / av
      bw = min / bv
    } else {
      aw = winner === "a" ? 1 : winner === "b" ? 0.5 : 1
      bw = winner === "b" ? 1 : winner === "a" ? 0.5 : 1
    }
  }

  return { ...stat, av, bv, winner, aw, bw }
}

function Cutout({ id, name }) {
  const [src, setSrc] = useState(`${BASE}images/players/cutouts/${id}.png`)
  return (
    <img
      className="cmp-cutout"
      src={src}
      alt={name}
      onError={() => setSrc(`${BASE}images/players/cutouts/default.png`)}
    />
  )
}

function PlayerPicker({ profiles, selectedId, otherId, onSelect, side }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function esc(e) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div className={`cmp-picker cmp-picker-${side}`} ref={ref}>
      <button type="button" className="cmp-picker-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {selectedId ? "Change player" : "Select player"} <ChevronDownIcon size={16} />
      </button>

      {open && (
        <ul className="cmp-picker-list" role="listbox">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={String(p.id) === String(selectedId)}
                disabled={String(p.id) === String(otherId)}
                className={String(p.id) === String(selectedId) ? "is-selected" : ""}
                onClick={() => {
                  onSelect(String(p.id))
                  setOpen(false)
                }}
              >
                <img
                  src={`${BASE}images/players/${p.id}.jpg`}
                  alt=""
                  onError={(e) => {
                    e.target.src = `${BASE}images/players/default.jpg`
                  }}
                />
                <span>{p.name}</span>
                <small>{p.tourRank ? `#${p.tourRank.position}` : "—"}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlayerSlot({ profile, side, profiles, otherId, onSelect }) {
  return (
    <div className={`cmp-slot cmp-slot-${side}${profile ? "" : " is-empty"}`}>
      <div className="cmp-slot-art">
        {profile ? (
          <>
            <span className="cmp-slot-rank">
              {profile.tourRank ? (
                <><small>Rank</small>{profile.tourRank.position}</>
              ) : (
                <small>Unranked</small>
              )}
            </span>
            {profile.homeCourse && (
              <span className="cmp-slot-crest" title={profile.homeCourse}>
                <CourseCrest course={profile.homeCourse} playerId={profile.id} size={36} onDark />
              </span>
            )}
            <Cutout key={profile.id} id={profile.id} name={profile.name} />
          </>
        ) : (
          <div className="cmp-slot-empty">
            <span>?</span>
            <p>Pick a player to compare</p>
          </div>
        )}
      </div>

      <div className="cmp-slot-info">
        {profile ? (
          <>
            <Link to={`/player-profile/${profile.id}`} className="cmp-slot-name">
              {profile.name}
            </Link>
            <span className="cmp-slot-meta">
              <UsaFlag width={16} /> USA
              {profile.age !== null && <> · Age {profile.age}</>}
              {profile.homeCourse && <> · {profile.homeCourse}</>}
            </span>
          </>
        ) : (
          <span className="cmp-slot-name is-placeholder">Player {side.toUpperCase()}</span>
        )}

        <PlayerPicker
          profiles={profiles}
          selectedId={profile?.id}
          otherId={otherId}
          onSelect={onSelect}
          side={side}
        />
      </div>
    </div>
  )
}

// Every event both players played, with how each finished.
function getHeadToHead(a, b) {
  const byEvent = {}
  b.results.forEach((r) => {
    byEvent[r.eventId] = r
  })
  return a.results
    .filter((r) => byEvent[r.eventId])
    .map((r) => ({ a: r, b: byEvent[r.eventId], teammates: r.team === byEvent[r.eventId].team }))
    .reverse()
}

function ComparePlayers() {

  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)

  const idA = searchParams.get("a") || ""
  const idB = searchParams.get("b") || ""

  useEffect(() => {

    Promise.all([getPlayers(), getMatchEntry(), getEvents(), getHoleByHole()])
      .then(([players, matchEntry, events, holeRows]) => {
        const built = buildPlayerProfiles({ players, matchEntry, events, holeRows })
        const list = Object.values(built.profiles)
          .filter((p) => !p.isSub)
          .sort((x, y) => (x.tourRank?.position ?? 999) - (y.tourRank?.position ?? 999) || x.name.localeCompare(y.name))
        setData({ list })
      })
      .catch((error) => console.error("Compare Players Error:", error))

  }, [])

  function setIds(a, b) {
    const params = {}
    if (a) params.a = a
    if (b) params.b = b
    setSearchParams(params, { replace: true })
  }

  if (!data) {
    return (
      <section className="card">
        <h2>Compare Players</h2>
        <p>Loading players...</p>
      </section>
    )
  }

  const a = data.list.find((p) => String(p.id) === idA) || null
  const b = data.list.find((p) => String(p.id) === idB) || null

  const sections = SECTIONS.map((section) => ({
    ...section,
    rows: section.stats.map((stat) => compareStat(stat, a, b)),
  }))

  const allRows = sections.flatMap((s) => s.rows)
  const aWins = allRows.filter((r) => r.winner === "a").length
  const bWins = allRows.filter((r) => r.winner === "b").length
  const decided = aWins + bWins

  const lastName = (p) => p.name.split(" ").slice(-1)[0]
  const headToHead = a && b ? getHeadToHead(a, b) : []

  return (

    <section className="card cmp">

      <div className="cmp-head">
        <div>
          <h2>Compare Players</h2>
          <p>Head-to-head across every stat the tour tracks.</p>
        </div>
      </div>

      <div className="cmp-matchup">
        <PlayerSlot profile={a} side="a" profiles={data.list} otherId={idB} onSelect={(id) => setIds(id, idB)} />

        <div className="cmp-vs">
          <span>VS</span>
          {(a || b) && (
            <button type="button" className="cmp-swap" onClick={() => setIds(idB, idA)} aria-label="Swap players" title="Swap players">
              <SwapIcon size={18} />
            </button>
          )}
        </div>

        <PlayerSlot profile={b} side="b" profiles={data.list} otherId={idA} onSelect={(id) => setIds(idA, id)} />
      </div>

      {a && b ? (
        <>
          <div className="cmp-tally">
            <div className="cmp-tally-text">
              <span className="cmp-a-ink"><b>{aWins}</b> {lastName(a)}</span>
              <strong>
                {aWins === bWins
                  ? "Dead even"
                  : `${aWins > bWins ? lastName(a) : lastName(b)} leads ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}`}
              </strong>
              <span className="cmp-b-ink">{lastName(b)} <b>{bWins}</b></span>
            </div>
            <div className="cmp-tally-bar" aria-hidden="true">
              <span className="cmp-a-fill" style={{ flexGrow: decided ? aWins : 1 }} />
              <span className="cmp-b-fill" style={{ flexGrow: decided ? bWins : 1 }} />
            </div>
            <p>Categories won out of {allRows.length} compared</p>
          </div>

          {sections.map((section) => (
            <div className="cmp-section" key={section.title}>
              <div className="cmp-section-head">
                <h3>{section.title}</h3>
                {section.note && <span>{section.note}</span>}
              </div>

              {section.rows.map((row) => (
                <div className="cmp-row" key={row.label}>
                  <div className={`cmp-side cmp-side-a${row.winner === "a" ? " is-winner" : ""}`}>
                    <b>{row.format(row.av)}</b>
                    <span className="cmp-bar"><span style={{ width: `${row.aw * 100}%` }} /></span>
                  </div>

                  <div className="cmp-label">{row.label}</div>

                  <div className={`cmp-side cmp-side-b${row.winner === "b" ? " is-winner" : ""}`}>
                    <span className="cmp-bar"><span style={{ width: `${row.bw * 100}%` }} /></span>
                    <b>{row.format(row.bv)}</b>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="cmp-section">
            <div className="cmp-section-head">
              <h3>Head to Head</h3>
              <span>Events both players played</span>
            </div>

            {headToHead.length === 0 ? (
              <p className="cmp-empty">These two haven&apos;t played the same event yet.</p>
            ) : (
              <ul className="cmp-h2h">
                {headToHead.map(({ a: ra, b: rb, teammates }) => {
                  const better = ra.placement === rb.placement ? null : ra.placement < rb.placement ? "a" : "b"
                  return (
                    <li key={ra.eventId}>
                      <span className={`cmp-h2h-pos${better === "a" ? " is-winner cmp-a-ink" : ""}`}>{ordinal(ra.placement)}</span>
                      <div className="cmp-h2h-event">
                        <strong>{ra.eventName}</strong>
                        <span>{ra.date} · {ra.course}</span>
                        {teammates && <span className="cmp-h2h-tag">Teammates</span>}
                      </div>
                      <span className={`cmp-h2h-pos${better === "b" ? " is-winner cmp-b-ink" : ""}`}>{ordinal(rb.placement)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="cmp-empty cmp-empty-center">
          Choose {a || b ? "one more player" : "two players"} above to see the full comparison.
        </p>
      )}

    </section>

  )

}

export default ComparePlayers
