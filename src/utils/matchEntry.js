// Rank, Total Power Score, Ranking Points Total, Events Played, Wins,
// Runner Ups, and Top 3 Finishes are all season-running values that the
// sheet repeats identically across every row for a given player (even
// future/unplayed event rows), so it's safe to take them from the first
// row found for that player.
export function getPlayerSummaries(matchEntry) {

  const summaries = {}

  matchEntry.forEach((row) => {

    if (!row.Player) return

    const name = row.Player.trim()

    if (summaries[name]) return

    summaries[name] = {
      rank: row["Current Rank"] ? Number(row["Current Rank"]) : null,
      totalPowerScore: row["Total Power Score"] ? Number(row["Total Power Score"]) : 0,
      rankingPointsTotal: row["Ranking Points Total"] ? Number(row["Ranking Points Total"]) : 0,
      avgRankingPoints: row["AVG Ranking Points"] ? Number(row["AVG Ranking Points"]) : 0,
      eventsPlayed: row["Events Played"] ? Number(row["Events Played"]) : 0,
      wins: row.Wins ? Number(row.Wins) : 0,
      runnerUps: row["Runner Ups"] ? Number(row["Runner Ups"]) : 0,
      topThree: row["Top 3 Finishes"] ? Number(row["Top 3 Finishes"]) : 0,
    }

  })

  return summaries

}

// Rows with no Contributions entered yet (a future/unplayed event) still
// carry season-running totals, but shouldn't count as an actually played
// row for things like grouping team scores.
export function getPlayedMatchEntryRows(matchEntry) {
  return matchEntry.filter((row) => row.Player && row.Contributions)
}

// Power points the commissioner awarded for events a player didn't play
// (Admin > Award Points) go on top of the sheet's Total Power Score on each
// of that player's rows. The awards themselves stay on the list as
// `matchEntry.awards` for the player profile.
export function withAwards(matchEntry, awards) {

  const bonus = {}

  awards.forEach((award) => {
    const name = (award.player || "").trim().toLowerCase()
    bonus[name] = (bonus[name] || 0) + (Number(award.points) || 0)
  })

  matchEntry.forEach((row) => {
    const extra = row.Player ? bonus[row.Player.trim().toLowerCase()] : 0
    if (extra) row["Total Power Score"] = String((Number(row["Total Power Score"]) || 0) + extra)
  })

  matchEntry.awards = awards

  return matchEntry

}
