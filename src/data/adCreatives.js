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
  // jonsstuff: [
  //   { desktop: "images/ads/jons-stuff-2-tall.png", mobile: "images/ads/jons-stuff-2-wide.png" },
  // ],
}

export function adKey(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function extraCreatives(title) {
  const base = import.meta.env.BASE_URL
  return (AD_CREATIVES[adKey(title)] || []).map((c) => ({
    desktop: base + c.desktop,
    mobile: base + c.mobile,
  }))
}
