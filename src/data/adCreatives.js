// Extra designs for a sponsor's ad, on top of the two pictures saved in
// Admin > Sponsors. The banner slides through all of them, one after
// another. Matched on the sponsor name (Advertisement Title), ignoring
// case and anything that isn't a letter or number, so "Jon's Stuff",
// "Jons Stuff" and "JON'S STUFF" all match "jonsstuff".
//
// desktop: tall picture, about 216 x 656 (right side on big screens)
// mobile:  wide picture, about 1457 x 225 (bottom bar on phones)
// Paths are inside public/.

export const AD_CREATIVES = {
  jonsstuff: [
    { desktop: "images/ads/jons-stuff-fresh-pulls-tall.png", mobile: "images/ads/jons-stuff-fresh-pulls-wide.png" },
    { desktop: "images/ads/jons-stuff-graded-slabs-tall.png", mobile: "images/ads/jons-stuff-graded-slabs-wide.png" },
    { desktop: "images/ads/jons-stuff-every-sport-tall.png", mobile: "images/ads/jons-stuff-every-sport-wide.png" },
  ],
}

export function adKey(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function extraCreatives(title) {
  const base = import.meta.env.BASE_URL
  const key = adKey(title)
  // Exact match first, otherwise a name that contains the key
  // (e.g. "Jon's Stuff Sports Cards").
  const match = AD_CREATIVES[key]
    || Object.entries(AD_CREATIVES).find(([k]) => key && key.includes(k))?.[1]
    || []
  return match.map((c) => ({
    desktop: base + c.desktop,
    mobile: base + c.mobile,
  }))
}
