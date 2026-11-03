// PREVIEW: a magazine-style player profile ("The Player Issue").
// Same data as the regular profile (utils/playerProfile.js), laid out like a
// feature spread: cover, story, the numbers, the trading card, the season,
// favourite partners and a photo album. Sections fade and slide in as you
// scroll, and moving to the next player uses a smooth page transition.

import { Link, useParams } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

import { getPlayers, getMatchEntry, getEvents, getHoleByHole, getGallery } from "../data/googleSheets"
import { buildPlayerProfiles, formatRank, formatToPar } from "../utils/playerProfile"
import { formatCurrency } from "../utils/winnings"
import { ordinal } from "../utils/ordinal"
import { COURSES, LOGO } from "../siteConfig"
import TradingCardModal from "../components/TradingCardModal"
import CourseCrest from "../components/CourseCrest"
import { UsaFlag, ArrowRightIcon, CardIcon } from "../components/Icons"
import { cutoutUrl, headshotUrl, nextPlayerImage, playerImageFallback } from "../utils/headshot"

const BASE = import.meta.env.BASE_URL
const CARD_SCENE = `${BASE}images/cards/course-bg.jpg`

const num = (v, digits = 1) => (v === null || v === undefined ? "-" : v.toFixed(digits))
const yearOf = (r) => (r.dateValue ? r.dateValue.getFullYear() : "")

function courseImage(course) {
  const key = (course || "").toLowerCase()
  const match = COURSES.find((c) => key && key.includes(c.name.toLowerCase().split(" ")[0].replace(/\./g, "")))
    || COURSES.find((c) => key && key.replace(/\./g, "").includes(c.name.toLowerCase().replace(/\./g, "")))
  return match ? match.image : CARD_SCENE
}

// Fades/slides a block in the first time it scrolls into view.
function Reveal({ as: Tag = "div", className = "", delay = 0, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined")

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shown])

  return (
    <Tag
      ref={ref}
      className={`mag-reveal${shown ? " is-in" : ""} ${className}`}
      style={{ "--delay": `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

function Cutout({ id, name, className }) {
  const [src, setSrc] = useState(cutoutUrl(id))
  return <img className={className} src={src} alt={name} onError={() => setSrc(nextPlayerImage)} />
}

/* ------------------------------------------------------------------ */
/* Story text, written from the numbers                               */
/* ------------------------------------------------------------------ */

function writeStory(profile, fieldSize) {
  const first = profile.name.split(" ")[0]
  const c = profile.career
  const joinYear = (profile.joinDate.match(/\d{4}/) || [])[0]
  const best = profile.results.length ? Math.min(...profile.results.map((r) => r.placement || 99)) : null

  const opener = joinYear
    ? `Since joining the Horses Tour in ${joinYear}, ${first} has teed it up ${c.events} time${c.events === 1 ? "" : "s"}`
    : `${first} has teed it up ${c.events} time${c.events === 1 ? "" : "s"} on the Horses Tour`

  const wins = c.wins
    ? `, picking up ${c.wins} win${c.wins === 1 ? "" : "s"}${c.majors ? `, ${c.majors} of them major${c.majors === 1 ? "" : "s"}` : ""} and ${formatCurrency(c.winnings)} along the way.`
    : best
      ? `. The first win is still out there, but a best finish of ${ordinal(best)} says it isn't far off.`
      : "."

  const rank = profile.tourRank
    ? ` Right now that's good for ${ordinal(profile.tourRank.position)} on the tour out of ${fieldSize} players`
    : ""

  const contribution = profile.averages.contribution !== null
    ? `${rank ? "," : " On average"} carrying ${profile.averages.contribution.toFixed(0)}% of the team's work every time out.`
    : rank ? "." : ""

  return `${opener}${wins}${rank}${contribution}`
}

function bestPartners(profile) {
  const byName = {}
  profile.results.forEach((r) => {
    r.partners.forEach((p) => {
      if (!byName[p]) byName[p] = { name: p, events: 0, wins: 0, finishes: [] }
      byName[p].events += 1
      if (r.placement === 1) byName[p].wins += 1
      if (r.placement) byName[p].finishes.push(r.placement)
    })
  })
  return Object.values(byName)
    .map((p) => ({ ...p, avg: p.finishes.length ? p.finishes.reduce((a, b) => a + b, 0) / p.finishes.length : null }))
    .sort((a, b) => b.wins - a.wins || b.events - a.events || (a.avg ?? 99) - (b.avg ?? 99))
    .slice(0, 4)
}

/* ------------------------------------------------------------------ */
/* Sections                                                           */
/* ------------------------------------------------------------------ */

function Cover({ profile, season, fieldSize }) {
  const parts = profile.name.split(" ")
  const last = parts.length > 1 ? parts.pop() : profile.name
  const first = parts.join(" ")
  const s = profile.seasons[season] || { wins: 0, topThree: 0, events: 0 }

  return (
    <header className="mag-cover" style={{ "--cover-img": `url(${courseImage(profile.homeCourse)})` }}>
      <div className="mag-cover-masthead">
        <img src={LOGO} alt="" />
        <span className="mag-masthead-title">Horses Tour</span>
        <span className="mag-masthead-issue">The Player Issue · No. {String(profile.id).padStart(3, "0")} · {season}</span>
      </div>

      <h1 className="mag-cover-name" aria-label={profile.name}>
        <span className="mag-cover-first">{first}</span>
        <span className="mag-cover-last">{last}</span>
      </h1>

      <Cutout id={profile.id} name={profile.name} className="mag-cover-cutout" />

      <ul className="mag-cover-lines">
        <li>
          <b>{profile.career.wins}</b>
          <span>Tour win{profile.career.wins === 1 ? "" : "s"}{profile.career.majors ? ` · ${profile.career.majors} major${profile.career.majors === 1 ? "" : "s"}` : ""}</span>
        </li>
        <li>
          <b>{profile.tourRank ? `#${profile.tourRank.position}` : "-"}</b>
          <span>on tour, of {fieldSize}</span>
        </li>
        <li>
          <b>{s.topThree}</b>
          <span>top-3 finishes in {season}</span>
        </li>
      </ul>

      <div className="mag-cover-foot">
        <span>Inside</span>
        <a href="#mag-story">The Story</a>
        <a href="#mag-numbers">By the Numbers</a>
        <a href="#mag-card">The Card</a>
        <a href="#mag-season">The Season</a>
        <a href="#mag-album">The Album</a>
      </div>
    </header>
  )
}

function Story({ profile, fieldSize }) {
  const story = writeStory(profile, fieldSize)
  const quote = profile.lastWin
    ? { text: `Won the ${profile.lastWin.eventName}`, sub: `${profile.lastWin.course} · with ${profile.lastWin.partners.join(" & ") || "—"} · ${formatToPar(profile.lastWin.teamScore)}` }
    : profile.bestPointsEvent
      ? { text: `${ordinal(profile.bestPointsEvent.placement)} at the ${profile.bestPointsEvent.eventName}`, sub: "Best finish so far" }
      : null

  return (
    <section className="mag-story" id="mag-story">
      <Reveal className="mag-kicker">The Story</Reveal>

      <div className="mag-story-grid">
        <Reveal as="p" className="mag-dropcap" delay={80}>{story}</Reveal>

        <Reveal as="aside" className="mag-facts" delay={180}>
          <dl>
            <div><dt>Home Course</dt><dd>
              {profile.homeCourse ? (
                <><CourseCrest course={profile.homeCourse} playerId={profile.id} size={22} /> {profile.homeCourse}</>
              ) : "-"}
            </dd></div>
            <div><dt>Born</dt><dd>{profile.bornText || "-"}</dd></div>
            <div><dt>Age</dt><dd>{profile.age ?? "-"}</dd></div>
            <div><dt>Turned Pro</dt><dd>{profile.joinDate || "-"}</dd></div>
            <div><dt>Country</dt><dd><UsaFlag width={18} /> USA</dd></div>
          </dl>
        </Reveal>
      </div>

      {quote && (
        <Reveal as="blockquote" className="mag-pullquote" delay={120}>
          <p>{quote.text}</p>
          <cite>{quote.sub}</cite>
        </Reveal>
      )}
    </section>
  )
}

function Numbers({ profile, fieldSize }) {
  const c = profile.career
  const items = [
    { value: c.wins, label: "Wins" },
    { value: `${c.topThree}/${c.events}`, label: "Top 3" },
    { value: num(profile.averages.finish), label: "Avg Finish" },
    { value: Math.round(c.powerPoints), label: "Power Pts" },
    { value: profile.tourRank ? formatRank(profile.tourRank) : "-", label: `Rank of ${fieldSize}` },
    { value: formatCurrency(c.winnings), label: "Earnings" },
  ]

  return (
    <section className="mag-numbers" id="mag-numbers">
      <Reveal className="mag-kicker mag-kicker-light">By the Numbers</Reveal>
      <div className="mag-numbers-grid">
        {items.map((it, i) => (
          <Reveal key={it.label} className="mag-number" delay={i * 70}>
            <b>{it.value}</b>
            <span>{it.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function CardSpread({ profile, onOpen }) {
  const seasons = Object.entries(profile.seasons)
    .filter(([y]) => y !== "Unknown")
    .sort((a, b) => a[0] - b[0])
  const currentYear = seasons.length ? seasons[seasons.length - 1][0] : String(new Date().getFullYear())
  const parts = profile.name.split(" ")
  const lastName = parts.length > 1 ? parts.pop() : profile.name
  const firstName = parts.join(" ")
  const [photo, setPhoto] = useState(cutoutUrl(profile.id))

  return (
    <section className="mag-card" id="mag-card">
      <Reveal className="mag-kicker">The Card</Reveal>

      <div className="mag-card-grid">
        <Reveal className="mag-card-stage" delay={60}>
          <button type="button" className="mag-card-button" onClick={onOpen} aria-label="Open trading card">
            <div className="tc-flipper mag-card-flipper">
              <div className="tc-face tc-front">
                <div className="tc-frame">
                  <div className="tc-holo" />
                  <div className="tc-edge" />
                  <div className="tc-art">
                    <div className="tc-art-scene" style={{ backgroundImage: `url(${CARD_SCENE})` }} />
                    <img className="tc-photo" src={photo} alt="" onError={() => setPhoto(nextPlayerImage)} />
                    <div className="tc-art-corner"><img src={LOGO} alt="" /></div>
                    <div className="tc-topline">
                      <span className="tc-brand"><span>HORSES</span><span>TOUR</span><span>COLLECTION</span></span>
                      <span className="tc-year">{currentYear}</span>
                    </div>
                  </div>
                  <div className="tc-nameplate">
                    <div className="tc-nameplate-text">
                      <span>{firstName}</span>
                      <strong>{lastName}</strong>
                      {profile.homeCourse && (
                        <em className="tc-home">
                          <CourseCrest course={profile.homeCourse} playerId={profile.id} size={16} onDark />
                          {profile.homeCourse}
                        </em>
                      )}
                    </div>
                    <div className="tc-nameplate-meta"><span className="tc-flag"><UsaFlag width={20} /> USA</span></div>
                  </div>
                  <div className="tc-strip">
                    <div><b>{profile.tourRank ? `#${profile.tourRank.position}` : "-"}</b><span>Rank</span></div>
                    <div><b>{profile.career.wins}</b><span>Wins</span></div>
                    <div><b>{profile.career.majors}</b><span>Majors</span></div>
                    <div><b>{formatCurrency(profile.career.winnings)}</b><span>Earnings</span></div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </Reveal>

        <Reveal className="mag-card-notes" delay={160}>
          <h2>Collector&apos;s notes</h2>
          <p>Card No. {String(profile.id).padStart(3, "0")} from the {currentYear} Horses Tour Collection. Tap the card to flip it and save it to your phone.</p>

          <table className="mag-table">
            <thead>
              <tr><th>Year</th><th>Events</th><th>Wins</th><th>Top 3</th><th>Pts</th><th>$</th></tr>
            </thead>
            <tbody>
              {seasons.map(([year, s]) => (
                <tr key={year}>
                  <td>{year}</td><td>{s.events}</td><td>{s.wins}</td><td>{s.topThree}</td>
                  <td>{s.rankingPoints.toFixed(1)}</td><td>{formatCurrency(s.winnings)}</td>
                </tr>
              ))}
              <tr className="is-total">
                <td>Career</td><td>{profile.career.events}</td><td>{profile.career.wins}</td><td>{profile.career.topThree}</td>
                <td>{profile.career.rankingPoints.toFixed(1)}</td><td>{formatCurrency(profile.career.winnings)}</td>
              </tr>
            </tbody>
          </table>

          <button type="button" className="mag-btn" onClick={onOpen}>
            <CardIcon size={16} /> Flip &amp; save the card
          </button>
        </Reveal>
      </div>
    </section>
  )
}

function Season({ profile, season }) {
  const rows = profile.results.filter((r) => yearOf(r) === Number(season))
  const list = rows.length ? rows : profile.results
  const data = list.map((r) => ({
    label: r.eventName.replace(/^(The|\d{4})\s+/i, "").split(" ")[0],
    eventName: r.eventName,
    points: Math.round(r.rankingPoints * 100) / 100,
    win: r.placement === 1,
  }))

  return (
    <section className="mag-season" id="mag-season">
      <Reveal className="mag-kicker">The {rows.length ? season : "Career"} Season</Reveal>

      <Reveal className="mag-chart" delay={60}>
        <h3>Ranking points, event by event <small><i className="mag-key-win" /> Win</small></h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} interval={0} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
              formatter={(v) => [v.toFixed(2), "Ranking points"]}
              labelFormatter={(_, p) => p?.[0]?.payload?.eventName || ""}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
            <Bar dataKey="points" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.eventName} fill={d.win ? "#c9a227" : "var(--mag-bar)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Reveal>

      <ol className="mag-log">
        {[...list].reverse().map((r, i) => (
          <Reveal as="li" key={r.eventId} delay={Math.min(i, 6) * 60} className={r.placement === 1 ? "is-win" : ""}>
            <span className="mag-log-pos">{r.placement ? ordinal(r.placement) : "-"}</span>
            <div>
              <strong>{r.eventName}{r.isMajor && <em> ★ {r.type}</em>}</strong>
              <span>{r.date} · {r.course} · with {r.partners.join(" & ") || "—"}</span>
            </div>
            <span className="mag-log-score">{formatToPar(r.teamScore)}</span>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}

function Partners({ profile, playerIds }) {
  const partners = bestPartners(profile)
  if (!partners.length) return null

  return (
    <section className="mag-partners">
      <Reveal className="mag-kicker">Favourite Partners</Reveal>
      <div className="mag-partners-grid">
        {partners.map((p, i) => {
          const id = playerIds[p.name.toLowerCase()]
          const inner = (
            <>
              <img src={headshotUrl(id)} alt="" onError={playerImageFallback} />
              <strong>{p.name}</strong>
              <span>{p.events} event{p.events === 1 ? "" : "s"} · {p.wins} win{p.wins === 1 ? "" : "s"}</span>
              <small>Avg finish {num(p.avg)}</small>
            </>
          )
          return (
            <Reveal key={p.name} delay={i * 80} className="mag-partner">
              {id ? <Link to={`/player-profile-preview/${id}`} viewTransition>{inner}</Link> : <div>{inner}</div>}
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

function Album({ profile, photos }) {
  const first = profile.name.split(" ")[0].toLowerCase()
  const last = profile.name.split(" ").slice(-1)[0].toLowerCase()
  const played = new Set(profile.results.map((r) => String(r.eventId)))
  // Photos that name the player first, then photos from events they played.
  const named = photos.filter((p) => {
    const text = `${p.Caption || ""}`.toLowerCase()
    return text.includes(last) || text.includes(first)
  })
  const fromEvents = photos.filter((p) => !named.includes(p) && played.has(String(p["Event ID"] || "").trim()))
  const tagged = [...named, ...fromEvents]
  const shown = (tagged.length ? tagged : photos).slice(0, 5)

  return (
    <section className="mag-album" id="mag-album">
      <Reveal className="mag-kicker">The Album</Reveal>
      {shown.length === 0 ? (
        <p className="mag-empty">No photos yet. Add some in the Gallery and tag {profile.name.split(" ")[0]} in the caption.</p>
      ) : (
        <div className={`mag-album-grid count-${shown.length}`}>
          {shown.map((p, i) => (
            <Reveal as="figure" key={p.Image + i} delay={i * 90}>
              <img src={p.Image} alt={p.Caption || ""} loading="lazy" />
              {p.Caption && <figcaption>{p.Caption}</figcaption>}
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function PlayerMagazine() {
  const { name } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCard, setShowCard] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [players, matchEntry, events, holeRows, gallery] = await Promise.all([
          getPlayers(), getMatchEntry(), getEvents(), getHoleByHole(), getGallery().catch(() => []),
        ])
        const built = buildPlayerProfiles({ players, matchEntry, events, holeRows })
        const playerIds = {}
        players.forEach((p) => { playerIds[(p.Name || "").trim().toLowerCase()] = p["Player ID"] })
        const photos = gallery
          .map((p) => ({ ...p, Image: (p.Image || p.URL || p.Url || "").trim() }))
          .filter((p) => p.Image)
          .reverse()
        setData({ ...built, playerIds, photos })
      } catch (error) {
        console.error("Player Magazine Error:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [name])

  const profile = useMemo(
    () => data && Object.values(data.profiles).find((p) => String(p.id).trim() === String(name).trim()),
    [data, name]
  )

  if (loading) return <p className="pp-loading">Loading player...</p>
  if (!profile) return <h2>Player not found.</h2>

  const seasons = Object.keys(profile.seasons).filter((y) => y !== "Unknown").sort()
  const season = seasons.length ? Number(seasons[seasons.length - 1]) : new Date().getFullYear()

  // "Next issue": the next regular player by id.
  const others = Object.values(data.profiles)
    .filter((p) => !p.isSub && p.id)
    .sort((a, b) => Number(a.id) - Number(b.id))
  const next = others[(others.findIndex((p) => p.id === profile.id) + 1) % others.length]

  return (
    <article className="mag" key={profile.id}>
      <Cover profile={profile} season={season} fieldSize={data.fieldSize} />
      <Story profile={profile} fieldSize={data.fieldSize} />
      <Numbers profile={profile} fieldSize={data.fieldSize} />
      <CardSpread profile={profile} onOpen={() => setShowCard(true)} />
      <Season profile={profile} season={season} />
      <Partners profile={profile} playerIds={data.playerIds} />
      <Album profile={profile} photos={data.photos} />

      {next && next.id !== profile.id && (
        <Reveal className="mag-next">
          <Link to={`/player-profile-preview/${next.id}`} viewTransition>
            <span>Next issue</span>
            <strong>{next.name}</strong>
            <ArrowRightIcon size={22} />
          </Link>
          <Link to={`/player-profile/${profile.id}`} className="mag-classic">See the regular profile</Link>
        </Reveal>
      )}

      {showCard && <TradingCardModal profile={profile} onClose={() => setShowCard(false)} />}
    </article>
  )
}

export default PlayerMagazine
