import { Link } from "react-router-dom"
import Headshot from "./Headshot"
import { formatToPar } from "../utils/liveEvent"

// The event board: one big scorecard with a row per team, plus a panel
// showing how each team's shots were shared between its two players.

const FRONT = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const BACK = [9, 10, 11, 12, 13, 14, 15, 16, 17]

function scoreClass(strokes, par) {
  if (!strokes || !par) return ""
  const diff = strokes - par
  if (diff <= -2) return "sc-eagle"
  if (diff === -1) return "sc-birdie"
  if (diff === 1) return "sc-bogey"
  if (diff >= 2) return "sc-double"
  return "sc-par"
}

function total(values) {
  return values.reduce((a, b) => a + (Number(b) || 0), 0)
}

// 22.5 -> "22½"
function half(value) {
  const whole = Math.floor(value)
  return value - whole >= 0.5 ? `${whole || ""}½` : String(whole)
}

// Both players' contribution totals for a card, or null if none recorded.
function contributionTotals(card) {
  if (card.contributionTotals) {
    return card.contributionTotals.some((v) => v != null) ? card.contributionTotals.map((v) => v ?? 0) : null
  }
  if (!card.contributions) return null
  const played = card.strokes.map((s, h) => (s ? h : null)).filter((h) => h != null)
  if (!played.length) return null
  return [0, 1].map((i) => total(played.map((h) => card.contributions[h]?.[i])))
}

export function LiveBoardCard({ rows, pars, eventId, playerIds }) {
  const nineSum = (strokes, holes) => {
    const played = holes.filter((h) => strokes[h])
    return played.length ? total(played.map((h) => strokes[h])) : ""
  }

  return (
    <div className="lbd-card">
      <div className="lbd-scroll">
        <table className="lbd-table">
          <thead>
            <tr className="lbd-hole-row">
              <th className="lbd-pos">Pos</th>
              <th className="lbd-team">Team</th>
              <th className="lbd-topar">To Par</th>
              {FRONT.map((h) => <th key={h}>{h + 1}</th>)}
              <th className="lbd-sum">Out</th>
              {BACK.map((h) => <th key={h}>{h + 1}</th>)}
              <th className="lbd-sum">In</th>
              <th className="lbd-sum lbd-tot">Tot</th>
            </tr>
            <tr className="lbd-par-row">
              <th className="lbd-pos" />
              <th className="lbd-team">Par</th>
              <th className="lbd-topar" />
              {FRONT.map((h) => <td key={h}>{pars ? pars[h] : "-"}</td>)}
              <td className="lbd-sum">{pars ? total(FRONT.map((h) => pars[h])) : "-"}</td>
              {BACK.map((h) => <td key={h}>{pars ? pars[h] : "-"}</td>)}
              <td className="lbd-sum">{pars ? total(BACK.map((h) => pars[h])) : "-"}</td>
              <td className="lbd-sum lbd-tot">{pars ? total(pars) : "-"}</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const strokes = r.card.strokes
              const cell = (h) => (
                <td key={h}>
                  <span className={scoreClass(strokes[h], pars?.[h])}>{strokes[h] || ""}</span>
                </td>
              )
              const all = nineSum(strokes, [...FRONT, ...BACK])
              return (
                <tr key={r.letter} className="lbd-team-row">
                  <th className="lbd-pos">{r.pos}</th>
                  <th className="lbd-team">
                    <Link to={`/live/${eventId}/${r.letter}`}>
                      <span className="lbd-heads">
                        {r.players.map((p) => <Headshot key={p} id={playerIds[p]} />)}
                      </span>
                      <span className="lbd-names">
                        {r.players.map((p) => <b key={p}>{p}</b>)}
                        <small>{r.label}{r.submitted ? " · Submitted" : ""}</small>
                      </span>
                    </Link>
                  </th>
                  <th className={`lbd-topar${r.toPar < 0 ? " is-under" : ""}`}>
                    <b>{r.thru ? formatToPar(r.toPar) : "-"}</b>
                    <small>{r.thru === 18 ? "Final" : r.thru ? `Thru ${r.thru}` : ""}</small>
                  </th>
                  {FRONT.map(cell)}
                  <td className="lbd-sum">{nineSum(strokes, FRONT)}</td>
                  {BACK.map(cell)}
                  <td className="lbd-sum">{nineSum(strokes, BACK)}</td>
                  <td className="lbd-sum lbd-tot">{all || (r.thru === 18 && r.total ? r.total : "")}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="lbd-legend">
        <span><i className="sc-eagle" /> Eagle</span>
        <span><i className="sc-birdie" /> Birdie</span>
        <span><i className="sc-bogey" /> Bogey</span>
        <span><i className="sc-double" /> Double+</span>
        <span className="lbd-legend-tip">Tap a team for its full card</span>
      </div>
    </div>
  )
}

export function ContributionSplit({ rows, playerIds }) {
  return (
    <div className="csp">
      {rows.map((r) => {
        const totals = contributionTotals(r.card)
        const sum = totals ? totals[0] + totals[1] : 0
        const share = totals && sum > 0 ? Math.round((totals[0] / sum) * 100) : null
        return (
          <div key={r.letter} className="csp-row">
            <div className="csp-head">
              <span className="csp-label">{r.label}</span>
              <span className="csp-total">{totals ? `${half(sum)} shots counted` : "No contributions yet"}</span>
            </div>
            <div className="csp-players">
              <span className="csp-player">
                <Headshot id={playerIds[r.players[0]]} />
                <span>
                  <b>{r.players[0]}</b>
                  {totals && <small>{half(totals[0])} · {share}%</small>}
                </span>
              </span>
              <span className="csp-player csp-player-right">
                <span>
                  <b>{r.players[1] || ""}</b>
                  {totals && r.players[1] && <small>{half(totals[1])} · {100 - share}%</small>}
                </span>
                {r.players[1] && <Headshot id={playerIds[r.players[1]]} />}
              </span>
            </div>
            <div className="csp-bar" role="img" aria-label={totals ? `${share}% / ${100 - share}%` : "No contributions yet"}>
              {share != null ? (
                <>
                  <i className="csp-a" style={{ width: `${share}%` }} />
                  <i className="csp-b" style={{ width: `${100 - share}%` }} />
                </>
              ) : (
                <i className="csp-empty" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
