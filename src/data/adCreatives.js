// Ready-made ad designs (images in public/images/ads). Each one can be
// added as its own ad in Admin > Sponsors with one click, and from then on
// it's an ordinary sponsor row: edit it, give it dates or remove it there.
//
// desktop: tall picture, about 216 x 656 (right side on big screens)
// mobile:  wide picture, about 1457 x 225 (bottom bar on phones)

export const AD_DESIGNS = [
  { sponsor: "Jon's Stuff", name: "Fresh Pulls", file: "jons-stuff-fresh-pulls" },
  { sponsor: "Jon's Stuff", name: "Graded Slabs", file: "jons-stuff-graded-slabs" },
  { sponsor: "Jon's Stuff", name: "Every Sport", file: "jons-stuff-every-sport" },
]

// Full web addresses, so the sheet row works wherever the site is opened.
export function designPictures(design) {
  const base = new URL(`${import.meta.env.BASE_URL}images/ads/`, window.location.origin).href
  return {
    desktop: `${base}${design.file}-tall.png`,
    mobile: `${base}${design.file}-wide.png`,
  }
}

export function adKey(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
