// Winnings live on the Events tab, not Match Entry - each event row has a
// "Winner" column (the winning team's two names, separated by "/") and a
// per-person payout amount for that event. There's no per-player column;
// a player's total winnings is the sum of that payout across every event
// where their name appears in Winner.

// The sheet's winnings column header has a typo ("Winnings ({Per
// Person)") - match on "winnings" instead of the exact string, so this
// doesn't silently break if the header gets fixed later.
function findWinningsKey(sampleRow) {
  return Object.keys(sampleRow).find((key) => /winnings/i.test(key))
}

// Returns { [playerName]: totalWinnings } built from every played event
// with a non-blank Winner and a valid payout amount.
export function getPlayerWinnings(events) {

  const winnings = {}

  if (!events || events.length === 0) return winnings

  const winningsKey = findWinningsKey(events[0])

  if (!winningsKey) return winnings

  events.forEach((event) => {

    const amount = parseFloat((event[winningsKey] || "").replace(/[^0-9.-]/g, ""))

    if (!event.Winner || isNaN(amount) || amount <= 0) return

    event.Winner
      .split("/")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        winnings[name] = (winnings[name] || 0) + amount
      })

  })

  return winnings

}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0"
  return `$${amount.toLocaleString("en-US")}`
}
