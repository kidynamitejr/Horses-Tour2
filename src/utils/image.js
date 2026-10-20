// Phone photos are often 4-12 MB; shrink to 1600px on the long side as a
// JPEG (a few hundred KB) so uploads are quick on cell signal.

const MAX_SIDE = 1600

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file isn't a photo this browser can open."))
    }
    img.src = url
  })
}

// Returns { data: base64 JPEG without the data: prefix, preview: data URL }.
export async function shrinkImage(file, maxSide = MAX_SIDE) {
  const { img, url } = await loadImage(file)
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
  return { data: dataUrl.split(",")[1], preview: dataUrl }
}

// A player cut-out like scripts/make-player-cutouts.ps1 makes: the photo's
// white background, flood-filled in from the edges, turned transparent.
// Returns base64 PNG (no data: prefix), up to 720px tall.
export async function makeCutout(file, maxHeight = 720) {
  const { img, url } = await loadImage(file)
  const scale = Math.min(1, maxHeight / img.naturalHeight)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0, w, h)
  URL.revokeObjectURL(url)

  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data
  const isWhite = (i) => px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225
  const seen = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const p = stack.pop()
    if (seen[p]) continue
    seen[p] = 1
    if (!isWhite(p * 4)) continue
    px[p * 4 + 3] = 0
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL("image/png").split(",")[1]
}
