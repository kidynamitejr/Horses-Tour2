// Wins/Runner Ups/Top 3 are computed from Match Results (not any
// manually tracked column) so both teammates on a team automatically
// get credit for their team's finish, instead of relying on a
// hand-maintained column that can miss a player.
export function getTeamRecordCounts(matchResults) {

  const counts = {}

  matchResults.forEach((row) => {

    const finish = Number(row.Finish)

    if (!finish) return

    const teammates = [row["Player 1"], row["Player 2"]]
      .map((name) => name && name.trim())
      .filter(Boolean)

    teammates.forEach((name) => {

      if (!counts[name]) {
        counts[name] = { wins: 0, runnerUps: 0, topThree: 0 }
      }

      if (finish === 1) counts[name].wins += 1
      if (finish === 2) counts[name].runnerUps += 1
      if (finish <= 3) counts[name].topThree += 1

    })

  })

  return counts

}
