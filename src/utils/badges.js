import { getPlayedMatchEntryRows } from "./matchEntry"

// Same "how many percent did they contribute" parsing used on the match
// recap - the sheet's Contribution % column is only formatted as a
// percent for the very first event; every event after that is a raw
// decimal fraction (e.g. "0.6481481481" instead of "64.81%").
function parseContributionPercent(value) {
  if (value === "" || value === null || value === undefined) return null
  const str = String(value).trim()
  const num = str.endsWith("%") ? parseFloat(str) : parseFloat(str) * 100
  return isNaN(num) ? null : num
}

// Ranks every player by their cumulative average Match Ranking Points
// using only played rows through (and including) maxEventId - the same
// technique the Horsewide Leaderboard uses to reconstruct what standings
// looked like as of a past event.
function getRanksThroughEvent(playedRows, maxEventId) {

  const totals = {}

  playedRows
    .filter((row) => Number(row["Event ID"]) <= maxEventId)
    .forEach((row) => {

      const name = row.Player.trim()

      if (!totals[name]) totals[name] = { sum: 0, count: 0 }

      totals[name].sum += parseFloat(row["Match Ranking Points"]) || 0
      totals[name].count += 1

    })

  const ranked = Object.entries(totals)
    .map(([name, t]) => ({ name, avg: t.sum / t.count }))
    .sort((a, b) => b.avg - a.avg)

  const rankByName = {}

  ranked.forEach((player, index) => {
    rankByName[player.name] = index + 1
  })

  return rankByName

}

// The single biggest positive jump in Horsewide rank a player has ever
// made from one played event to the next.
function getBestComeback(playedRows, eventIds) {

  const best = {}

  for (let i = 1; i < eventIds.length; i++) {

    const prevRanks = getRanksThroughEvent(playedRows, eventIds[i - 1])
    const currRanks = getRanksThroughEvent(playedRows, eventIds[i])

    const playedThisEvent = new Set(
      playedRows
        .filter((row) => Number(row["Event ID"]) === eventIds[i])
        .map((row) => row.Player.trim())
    )

    playedThisEvent.forEach((name) => {

      const prev = prevRanks[name]
      const curr = currRanks[name]

      if (prev === undefined || curr === undefined) return

      const movement = prev - curr

      if (movement > (best[name] || 0)) best[name] = movement

    })

  }

  return best

}

// Builds the full badge set for every player in one pass over Match
// Entry. Each badge is { earned, detail } so the UI can show why it was
// (or wasn't) earned.
export function getPlayerBadges(matchEntry) {

  const playedRows = getPlayedMatchEntryRows(matchEntry)

  const eventIds = [...new Set(playedRows.map((row) => Number(row["Event ID"])))]
    .sort((a, b) => a - b)

  const totalPlayedEvents = eventIds.length

  const byPlayer = {}

  playedRows.forEach((row) => {

    const name = row.Player.trim()

    if (!byPlayer[name]) {
      byPlayer[name] = {
        eventsPlayed: 0,
        wins: 0,
        bestContribution: 0,
      }
    }

    byPlayer[name].eventsPlayed += 1

    if (Number(row.Placement) === 1) byPlayer[name].wins += 1

    const contribution = parseContributionPercent(row["Contribution %"])

    if (contribution !== null && contribution > byPlayer[name].bestContribution) {
      byPlayer[name].bestContribution = contribution
    }

  })

  const bestComeback = getBestComeback(playedRows, eventIds)

  const badges = {}

  Object.entries(byPlayer).forEach(([name, stats]) => {

    badges[name] = {
      ironMan: {
        earned: totalPlayedEvents > 0 && stats.eventsPlayed === totalPlayedEvents,
        icon: "🛡️",
        label: "Iron Man",
        detail: "Played in every event the tour has run.",
      },
      hatTrick: {
        earned: stats.wins >= 3,
        icon: "🎩",
        label: "Hat Trick",
        detail: `${stats.wins} career win${stats.wins === 1 ? "" : "s"}.`,
      },
      sharpShooter: {
        earned: stats.bestContribution >= 65,
        icon: "🎯",
        label: "Sharp Shooter",
        detail: `Best single-match contribution: ${stats.bestContribution.toFixed(1)}%.`,
      },
      comeback: {
        earned: (bestComeback[name] || 0) >= 3,
        icon: "📈",
        label: "Comeback Player",
        detail: `Biggest single-event rank jump: ${bestComeback[name] || 0} spot${(bestComeback[name] || 0) === 1 ? "" : "s"}.`,
      },
    }

  })

  return badges

}
