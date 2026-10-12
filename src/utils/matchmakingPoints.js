// Rows with no Contributions entered yet (a future/unplayed event that's
// been dragged down) still compute to 0 via sheet formulas, so they're
// excluded here rather than counted as a game played.
export function getPlayedContributions(contributions) {
  return contributions.filter((row) => row.Player && row.Contributions)
}

export function getEventsPlayedByPlayer(contributions) {

  const counts = {}

  getPlayedContributions(contributions).forEach((row) => {
    const name = row.Player.trim()
    counts[name] = (counts[name] || 0) + 1
  })

  return counts

}

export function getMatchmakingPointsByPlayer(contributions) {

  const totals = {}

  getPlayedContributions(contributions).forEach((row) => {

    const points = parseFloat(row["Match Points"])

    if (isNaN(points)) return

    const name = row.Player.trim()

    if (!totals[name]) {
      totals[name] = { sum: 0, count: 0 }
    }

    totals[name].sum += points
    totals[name].count += 1

  })

  const averages = {}

  Object.entries(totals).forEach(([name, { sum, count }]) => {
    averages[name] = sum / count
  })

  return averages

}
