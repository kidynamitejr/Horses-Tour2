// "M/D/YY" or "M/D/YYYY" from the Events tab -> "2026". Split by hand
// since browsers disagree on how to expand a 2-digit year.
export function getEventYear(dateText) {
  const parts = (dateText || "").split("/")
  if (parts.length !== 3) return ""
  const year = parts[2].trim()
  return year.length === 2 ? `20${year}` : year
}

// "Spring Open" on 4/12/26 -> "2026 Spring Open", so events that repeat
// every season can be told apart. Names that already start with a year
// are left alone.
export function withEventYear(name, dateText) {
  const trimmed = (name || "").trim()
  const year = getEventYear(dateText)
  if (!trimmed || !year || /^\d{4}\b/.test(trimmed)) return trimmed
  return `${year} ${trimmed}`
}

// The name to show for an Events tab row.
export function eventDisplayName(event, fallback = "") {
  if (!event) return fallback
  return withEventYear(event["Event Name"], event.Date) || fallback
}
