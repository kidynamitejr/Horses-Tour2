// Player photos live in the repo's uploads/players/ folder (cut-outs in
// uploads/players/cutouts/), the same way Gallery photos do, and are shown
// straight from GitHub - so a new headshot shows without the site rebuilding.
// If a photo isn't there yet, the older copy in the website's own
// images/players/ folder is tried, then the default silhouette.

const BASE = import.meta.env.BASE_URL
const UPLOADS = "https://raw.githubusercontent.com/kidynamitejr/Horses-Tour2/main/uploads/players/"
const LOCAL = `${BASE}images/players/`
const DEFAULT_PHOTO = `${LOCAL}default.jpg`
const DEFAULT_CUTOUT = `${LOCAL}cutouts/default.png`

const known = (id) => id !== undefined && id !== null && id !== "" && id !== "default"

export function headshotUrl(id) {
  return known(id) ? `${UPLOADS}${id}.jpg` : DEFAULT_PHOTO
}

export function cutoutUrl(id) {
  return known(id) ? `${UPLOADS}cutouts/${id}.png` : DEFAULT_CUTOUT
}

// The next photo to try after `src` fails to load.
export function nextPlayerImage(src) {
  const path = String(src || "").split("?")[0]
  if (path.startsWith(UPLOADS)) return LOCAL + path.slice(UPLOADS.length)
  return path.endsWith(".png") ? DEFAULT_CUTOUT : DEFAULT_PHOTO
}

// For an <img onError>: steps the image down the fallbacks above, stopping
// once the default has been tried.
export function playerImageFallback(e) {
  const img = e.currentTarget || e.target
  const next = nextPlayerImage(img.src)
  if (img.src.endsWith(next)) {
    img.onerror = null
    return
  }
  img.src = next
}
