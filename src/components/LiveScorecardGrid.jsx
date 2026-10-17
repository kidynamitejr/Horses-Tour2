import { useEffect, useRef } from "react"

// A real-style scorecard: one row of 18 holes with Out / In / Total,
// the par and team score rows, then a split and one contribution row per
// player. Scores get the usual marks - circle for birdie, double circle
// for eagle, square for bogey, double square for double bogey or worse.

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

function sum(values) {
  return values.reduce((total, v) => total + (Number(v) || 0), 0)
}

// 1.5 -> "1½"
function half(value) {
  const whole = Math.floor(value)
  const hasHalf = value - whole >= 0.5
  if (!hasHalf) return String(whole)
  return `${whole || ""}½`
}

function LiveScorecardGrid({
  pars,
  strokes,
  players = [],
  contributions = null,
  contributionTotals = null,
  selected = null,
  onSelect = null,
}) {
  const scrollRef = useRef(null)

  // Keep the hole being entered in view on narrow screens.
  useEffect(() => {
    const cell = scrollRef.current?.querySelector(".lsc-col.is-selected")
    cell?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [selected])

  const played = (holes) => holes.filter((h) => strokes[h])
  const scoreSum = (holes) => (played(holes).length ? sum(played(holes).map((h) => strokes[h])) : "")
  const parSum = (holes) => (pars ? sum(holes.map((h) => pars[h])) : "-")

  const contribution = (h, i) => {
    if (!contributions?.[h] || !strokes[h]) return ""
    return half(Number(contributions[h][i]) || 0)
  }
  const contributionSum = (holes, i) => {
    if (!contributions) return ""
    const entered = holes.filter((h) => strokes[h])
    return entered.length ? half(sum(entered.map((h) => contributions[h]?.[i]))) : ""
  }
  // Whole-round contributions as numbers (null when unknown).
  const totalValues = players.map((_, i) => {
    if (contributionTotals) return contributionTotals[i] ?? null
    if (!contributions) return null
    const entered = [...FRONT, ...BACK].filter((h) => strokes[h])
    return entered.length ? sum(entered.map((h) => contributions[h]?.[i])) : null
  })
  const contributionTotal = (i) => (totalValues[i] != null ? half(totalValues[i]) : "")
  const totalAll = sum(totalValues)

  const colClass = (h) => `lsc-col${selected === h ? " is-selected" : ""}`
  const pick = onSelect ? (h) => () => onSelect(h) : () => undefined

  const holeCells = (holes) =>
    holes.map((h) => (
      <th key={h} scope="col" className={colClass(h)}>
        {onSelect ? (
          <button type="button" onClick={pick(h)} aria-label={`Hole ${h + 1}`}>{h + 1}</button>
        ) : (
          h + 1
        )}
      </th>
    ))

  return (
    <div className="lsc-card">
      <div className="lsc-scroll" ref={scrollRef}>
        <table className="lsc-table">
          <thead>
            <tr className="lsc-hole-row">
              <th scope="row" className="lsc-label">Hole</th>
              {holeCells(FRONT)}
              <th scope="col" className="lsc-sum">Out</th>
              {holeCells(BACK)}
              <th scope="col" className="lsc-sum">In</th>
              <th scope="col" className="lsc-sum lsc-tot">Tot</th>
            </tr>
          </thead>
          <tbody>
            <tr className="lsc-par-row">
              <th scope="row" className="lsc-label">Par</th>
              {FRONT.map((h) => <td key={h} className={colClass(h)}>{pars ? pars[h] : "-"}</td>)}
              <td className="lsc-sum">{parSum(FRONT)}</td>
              {BACK.map((h) => <td key={h} className={colClass(h)}>{pars ? pars[h] : "-"}</td>)}
              <td className="lsc-sum">{parSum(BACK)}</td>
              <td className="lsc-sum lsc-tot">{pars ? sum(pars) : "-"}</td>
            </tr>

            <tr className="lsc-score-row">
              <th scope="row" className="lsc-label">Score</th>
              {FRONT.map((h) => (
                <td key={h} className={colClass(h)} onClick={pick(h)}>
                  <span className={scoreClass(strokes[h], pars?.[h])}>{strokes[h] || ""}</span>
                </td>
              ))}
              <td className="lsc-sum">{scoreSum(FRONT)}</td>
              {BACK.map((h) => (
                <td key={h} className={colClass(h)} onClick={pick(h)}>
                  <span className={scoreClass(strokes[h], pars?.[h])}>{strokes[h] || ""}</span>
                </td>
              ))}
              <td className="lsc-sum">{scoreSum(BACK)}</td>
              <td className="lsc-sum lsc-tot">{scoreSum([...FRONT, ...BACK])}</td>
            </tr>

            {players.map((name, i) => (
              <tr key={name} className={`lsc-contrib-line${i === 0 ? " is-first" : ""}`}>
                <th scope="row" className="lsc-label lsc-player">{name.split(" ")[0]}</th>
                {FRONT.map((h) => (
                  <td key={h} className={colClass(h)} onClick={pick(h)}>{contribution(h, i)}</td>
                ))}
                <td className="lsc-sum">{contributionSum(FRONT, i)}</td>
                {BACK.map((h) => (
                  <td key={h} className={colClass(h)} onClick={pick(h)}>{contribution(h, i)}</td>
                ))}
                <td className="lsc-sum">{contributionSum(BACK, i)}</td>
                <td className="lsc-sum lsc-tot">{contributionTotal(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {players.length > 0 && (
        <div className="lsc-contrib-summary">
          <span>Contributions</span>
          {players.map((name, i) => (
            <b key={name}>
              {name} <em>{contributionTotal(i) || "-"}</em>
              {totalAll > 0 && totalValues[i] != null && (
                <small>{Math.round((totalValues[i] / totalAll) * 100)}%</small>
              )}
            </b>
          ))}
        </div>
      )}
      {players.length > 0 && (
        <p className="lsc-card-foot">
          {contributions
            ? "Player rows show shot contributions per hole."
            : "Contribution totals only - per-hole contributions weren't tracked for this round."}
        </p>
      )}
    </div>
  )
}

export default LiveScorecardGrid
