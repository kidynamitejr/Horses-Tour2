// Gallery photos with the most recently added first. Each upload gets the
// next Photo ID, so sorting by it keeps the newest on top even if the
// sheet's rows get re-sorted; rows without an ID keep their sheet order
// (bottom row first) after the numbered ones.
export function newestPhotosFirst(rows) {
  return rows
    .filter((p) => p.Image)
    .map((p, row) => ({ p, row, id: Number(p["Photo ID"]) }))
    .sort((a, b) => {
      const aHasId = Number.isFinite(a.id) && String(a.p["Photo ID"] ?? "").trim() !== ""
      const bHasId = Number.isFinite(b.id) && String(b.p["Photo ID"] ?? "").trim() !== ""
      if (aHasId && bHasId && a.id !== b.id) return b.id - a.id
      if (aHasId !== bHasId) return aHasId ? -1 : 1
      return b.row - a.row
    })
    .map(({ p }) => p)
}
