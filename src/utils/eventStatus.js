// An event is finished once it has a Winner on the Events tab - the live
// scorecards fill that in as soon as every team's card is in, so the site
// moves on to the next event right after the round (not at midnight).
export function completedEventIds(events) {
  return new Set(
    events
      .filter((e) => (e.Winner || "").trim())
      .map((e) => (e["Event ID"] || "").trim()),
  )
}
