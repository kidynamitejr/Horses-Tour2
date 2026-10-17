import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { getPlayers, getMatchEntry, getEvents } from "../data/googleSheets"
import { buildPlayerProfiles } from "../utils/playerProfile"
import { formatCurrency } from "../utils/winnings"
import CourseCrest from "./CourseCrest"
import { UsaFlag } from "./Icons"

const BASE = import.meta.env.BASE_URL

const SORTS = {
  rank: { label: "Tour Rank", compare: (a, b) => (a.tourRank?.position ?? 999) - (b.tourRank?.position ?? 999) },
  wins: { label: "Wins", compare: (a, b) => b.career.wins - a.career.wins || b.career.topThree - a.career.topThree },
  earnings: { label: "Earnings", compare: (a, b) => b.career.winnings - a.career.winnings },
  name: { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
}

function PlayerPhoto({ id, name }) {
  const [src, setSrc] = useState(`${BASE}images/players/cutouts/${id}.png`)
  return (
    <img
      className="pc-photo"
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setSrc(`${BASE}images/players/cutouts/default.png`)}
    />
  )
}

function Players() {

  const [profiles, setProfiles] = useState(null)
  const [fieldSize, setFieldSize] = useState(0)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("rank")

  useEffect(() => {

    Promise.all([getPlayers(), getMatchEntry(), getEvents()]).then(([players, matchEntry, events]) => {

      const built = buildPlayerProfiles({ players, matchEntry, events, holeRows: [] })

      setProfiles(Object.values(built.profiles).filter((p) => !p.isSub))
      setFieldSize(built.fieldSize)

    })

  }, [])

  const shown = useMemo(() => {
    if (!profiles) return []
    const q = query.trim().toLowerCase()
    return profiles
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.homeCourse.toLowerCase().includes(q))
      .sort(SORTS[sort].compare)
  }, [profiles, query, sort])

  return (

    <section className="card players-card">

      <div className="players-head">
        <div>
          <h2>Players</h2>
          <p>{profiles ? `${profiles.length} players on tour · ${fieldSize} ranked` : "Loading players..."}</p>
        </div>

        <div className="players-controls">
          <input
            type="search"
            className="players-search"
            placeholder="Search players or courses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search players"
          />

          <div className="players-sort" role="group" aria-label="Sort players">
            {Object.entries(SORTS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={sort === key ? "active" : ""}
                onClick={() => setSort(key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pc-grid">

        {shown.map((p) => {

          const parts = p.name.split(" ")
          const last = parts.length > 1 ? parts.pop() : ""
          const first = parts.join(" ")

          return (

            <Link key={p.id} to={`/player-profile/${p.id}`} className="pc-card">

              <div className="pc-art">
                <span className="pc-rank">
                  {p.tourRank ? (
                    <>
                      <small>Rank</small>
                      {p.tourRank.position}
                    </>
                  ) : (
                    <small>Unranked</small>
                  )}
                </span>

                {p.homeCourse && (
                  <span className="pc-crest" title={p.homeCourse}>
                    <CourseCrest course={p.homeCourse} playerId={p.id} size={34} onDark />
                  </span>
                )}

                <PlayerPhoto id={p.id} name={p.name} />
              </div>

              <div className="pc-body">
                <h3>
                  <span>{first}</span>
                  {last && <strong>{last}</strong>}
                </h3>

                <p className="pc-meta">
                  <UsaFlag width={16} /> USA
                  {p.age !== null && <><span className="pc-dot">•</span>Age {p.age}</>}
                </p>

                <dl className="pc-stats">
                  <div>
                    <dt>Wins</dt>
                    <dd>{p.career.wins}</dd>
                  </div>
                  <div>
                    <dt>Majors</dt>
                    <dd className={p.career.majors ? "is-gold" : ""}>{p.career.majors}</dd>
                  </div>
                  <div>
                    <dt>Top 3</dt>
                    <dd>{p.career.topThree}</dd>
                  </div>
                  <div>
                    <dt>Earnings</dt>
                    <dd>{formatCurrency(p.career.winnings)}</dd>
                  </div>
                </dl>

                <span className="pc-cta">View Profile →</span>
              </div>

            </Link>

          )

        })}

      </div>

      {profiles && shown.length === 0 && (
        <p className="players-empty">No players match “{query}”.</p>
      )}

    </section>

  )

}

export default Players
