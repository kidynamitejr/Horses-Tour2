import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import html2canvas from "html2canvas"
import { formatCurrency } from "../utils/winnings"
import { formatRank } from "../utils/playerProfile"
import { ordinal } from "../utils/ordinal"
import { LOGO } from "../siteConfig"
import CourseCrest from "./CourseCrest"
import { UsaFlag } from "./Icons"

const BASE = import.meta.env.BASE_URL

// A collectible-style trading card (front + back) for a player profile.
// `profile` comes from buildPlayerProfiles (utils/playerProfile.js).
function TradingCardModal({ profile, onClose }) {

  const frontRef = useRef(null)
  const backRef = useRef(null)
  const [flipped, setFlipped] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [photo, setPhoto] = useState(`${BASE}images/players/cutouts/${profile.id}.png`)

  const seasons = Object.entries(profile.seasons)
    .filter(([year]) => year !== "Unknown")
    .sort((a, b) => a[0] - b[0])

  const currentYear = seasons.length ? seasons[seasons.length - 1][0] : String(new Date().getFullYear())
  const joinYear = (profile.joinDate.match(/\d{4}/) || [])[0]
  const isRookie = joinYear && joinYear === currentYear
  const cardNumber = String(profile.id).padStart(3, "0")
  const parts = profile.name.split(" ")
  const lastName = parts.length > 1 ? parts.pop() : profile.name
  const firstName = parts.length ? parts.join(" ") : ""

  async function handleDownload() {

    const face = flipped ? backRef.current : frontRef.current

    if (!face) return

    setDownloading(true)

    try {

      const canvas = await html2canvas(face, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      })

      const link = document.createElement("a")
      link.download = `${profile.name.replace(/\s+/g, "-").toLowerCase()}-trading-card${flipped ? "-back" : ""}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()

    } catch (error) {

      console.error("Trading Card Download Error:", error)

    } finally {

      setDownloading(false)

    }

  }

  return createPortal(

    <div className="tc-overlay" onClick={onClose}>

      <div className="tc-stage" onClick={(e) => e.stopPropagation()}>

        <button type="button" className="tc-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className={`tc-flipper${flipped ? " is-flipped" : ""}`}>

          {/* ---------------- FRONT ---------------- */}
          <div className="tc-face tc-front" ref={frontRef}>
            <div className="tc-frame">

              <div className="tc-art">
                <div className="tc-art-stripes" />
                <img className="tc-art-logo" src={LOGO} alt="" />

                <img
                  className="tc-photo"
                  src={photo}
                  alt={profile.name}
                  crossOrigin="anonymous"
                  onError={() => setPhoto(`${BASE}images/players/cutouts/default.png`)}
                />

                <div className="tc-topline">
                  <span className="tc-brand">
                    <img src={LOGO} alt="" />
                    HORSES TOUR
                  </span>
                  <span className="tc-year">{currentYear}</span>
                </div>

                {isRookie && (
                  <span className="tc-rookie" title="Rookie Card">
                    <b>RC</b>
                    <small>Rookie</small>
                  </span>
                )}
              </div>

              <div className="tc-nameplate">
                <div className="tc-nameplate-text">
                  <span>{firstName}</span>
                  <strong>{lastName}</strong>
                </div>
                <div className="tc-nameplate-meta">
                  <span className="tc-pos">PRO</span>
                  <span className="tc-flag"><UsaFlag width={20} /></span>
                </div>
              </div>

              <div className="tc-strip">
                <div><b>{profile.tourRank ? `#${profile.tourRank.position}` : "-"}</b><span>Rank</span></div>
                <div><b>{profile.career.wins}</b><span>Wins</span></div>
                <div><b>{profile.career.majors}</b><span>Majors</span></div>
                <div><b>{formatCurrency(profile.career.winnings)}</b><span>Earnings</span></div>
              </div>

            </div>
          </div>

          {/* ---------------- BACK ---------------- */}
          <div className="tc-face tc-back" ref={backRef}>
            <div className="tc-frame tc-back-frame">

              <div className="tc-back-head">
                <span className="tc-back-number">No. {cardNumber}</span>
                <div>
                  <strong>{profile.name}</strong>
                  <span>Horses Tour · {currentYear} Series</span>
                </div>
                <img src={LOGO} alt="" className="tc-back-logo" />
              </div>

              <dl className="tc-bio">
                <div><dt>Born</dt><dd>{profile.bornText || "-"}</dd></div>
                <div><dt>Age</dt><dd>{profile.age ?? "-"}</dd></div>
                <div><dt>Country</dt><dd>USA</dd></div>
                <div><dt>Turned Pro</dt><dd>{profile.joinDate || "-"}</dd></div>
                <div className="tc-bio-wide">
                  <dt>Home Course</dt>
                  <dd>
                    {profile.homeCourse ? (
                      <><CourseCrest course={profile.homeCourse} size={18} /> {profile.homeCourse}</>
                    ) : "-"}
                  </dd>
                </div>
              </dl>

              <table className="tc-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Ev</th>
                    <th>W</th>
                    <th>2nd</th>
                    <th>T3</th>
                    <th>Pts</th>
                    <th>$</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map(([year, s]) => (
                    <tr key={year}>
                      <td>{year}</td>
                      <td>{s.events}</td>
                      <td>{s.wins}</td>
                      <td>{s.runnerUps}</td>
                      <td>{s.topThree}</td>
                      <td>{s.rankingPoints.toFixed(1)}</td>
                      <td>{formatCurrency(s.winnings)}</td>
                    </tr>
                  ))}
                  <tr className="tc-table-total">
                    <td>Career</td>
                    <td>{profile.career.events}</td>
                    <td>{profile.career.wins}</td>
                    <td>{profile.career.runnerUps}</td>
                    <td>{profile.career.topThree}</td>
                    <td>{profile.career.rankingPoints.toFixed(1)}</td>
                    <td>{formatCurrency(profile.career.winnings)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="tc-back-highlights">
                <div>
                  <span>Tour Rank</span>
                  <b>{formatRank(profile.tourRank)}</b>
                </div>
                <div>
                  <span>Ranking Factor</span>
                  <b>{profile.averages.rankingFactor !== null ? profile.averages.rankingFactor.toFixed(2) : "-"}</b>
                </div>
                <div>
                  <span>Avg Contribution</span>
                  <b>{profile.averages.contribution !== null ? `${profile.averages.contribution.toFixed(0)}%` : "-"}</b>
                </div>
              </div>

              <p className="tc-back-fact">
                {profile.lastWin
                  ? `Last win: ${profile.lastWin.eventName} at ${profile.lastWin.course}, teaming with ${profile.lastWin.partners.join(" & ") || "—"}.`
                  : profile.results.length
                    ? `Best finish so far: ${ordinal(Math.min(...profile.results.map((r) => r.placement || 99)))} place. Still chasing that first Horses Tour win.`
                    : "Yet to tee it up on the Horses Tour - the debut is coming."}
              </p>

              <p className="tc-back-legal">© {currentYear} Horses Tour · Card {cardNumber}</p>

            </div>
          </div>

        </div>

        <div className="tc-actions">
          <button type="button" className="btn btn-light" onClick={() => setFlipped((f) => !f)}>
            ↻ Flip Card
          </button>
          <button type="button" className="btn btn-primary tc-download" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Preparing..." : `⬇ Download ${flipped ? "Back" : "Front"}`}
          </button>
        </div>

      </div>

    </div>,

    document.body

  )

}

export default TradingCardModal
