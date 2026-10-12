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
