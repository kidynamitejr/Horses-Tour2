import { ordinal } from "./ordinal"

// Finds every past played event where both of these two players were on
// the same team, and what place that team finished.
export function getPartnershipHistory(matchEntry, playerA, playerB) {

  const byEventTeam = {}

  matchEntry.forEach((row) => {

    if (!row.Player || !row.Contributions) return

    const key = `${row["Event ID"]}|${row.Team}`

    if (!byEventTeam[key]) byEventTeam[key] = []

    byEventTeam[key].push(row)

  })

  return Object.values(byEventTeam)
    .filter((rows) => {
      const names = rows.map((r) => r.Player.trim())
      return names.includes(playerA) && names.includes(playerB)
    })
    .map((rows) => ({
      eventId: rows[0]["Event ID"],
      placement: rows[0].Placement,
    }))
    .sort((a, b) => Number(a.eventId) - Number(b.eventId))

}

// "First pairing" or "2 events · best 3rd".
export function partnershipLabel(history) {
  if (history.length === 0) return "First pairing"
  const best = Math.min(...history.map((h) => Number(h.placement) || 99))
  return `${history.length} event${history.length > 1 ? "s" : ""} · best ${ordinal(best)}`
}
