// A paper-style scorecard: front nine and back nine stacked, with the
// usual marks - circle for birdie, double circle for eagle, square for
// bogey, double square for double bogey or worse.

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

function Nine({ start, label, pars, strokes, selected, onSelect }) {
  const holes = Array.from({ length: 9 }, (_, i) => start + i)
  const nineStrokes = holes.map((h) => strokes[h])
  const played = nineStrokes.filter(Boolean)

  return (
    <table className="lsc-table">
      <tbody>
        <tr className="lsc-hole-row">
          <th>Hole</th>
          {holes.map((h) => (
            <td key={h}>
              {onSelect ? (
                <button
                  type="button"
                  className={selected === h ? "is-selected" : ""}
                  onClick={() => onSelect(h)}
                  aria-label={`Hole ${h + 1}`}
                >
                  {h + 1}
                </button>
              ) : (
                h + 1
              )}
            </td>
          ))}
          <td className="lsc-sum">{label}</td>
        </tr>
        <tr className="lsc-par-row">
          <th>Par</th>
          {holes.map((h) => <td key={h}>{pars ? pars[h] : "-"}</td>)}
          <td className="lsc-sum">{pars ? sum(holes.map((h) => pars[h])) : "-"}</td>
        </tr>
        <tr className="lsc-score-row">
          <th>Score</th>
          {holes.map((h) => (
            <td
              key={h}
              className={selected === h ? "is-selected" : ""}
              onClick={onSelect ? () => onSelect(h) : undefined}
            >
              <span className={scoreClass(strokes[h], pars?.[h])}>{strokes[h] || ""}</span>
            </td>
          ))}
          <td className="lsc-sum">{played.length ? sum(played) : ""}</td>
        </tr>
      </tbody>
    </table>
  )
}

function LiveScorecardGrid({ pars, strokes, selected = null, onSelect = null }) {
  return (
    <div className="lsc">
      <Nine start={0} label="Out" pars={pars} strokes={strokes} selected={selected} onSelect={onSelect} />
      <Nine start={9} label="In" pars={pars} strokes={strokes} selected={selected} onSelect={onSelect} />
    </div>
  )
}

export default LiveScorecardGrid
