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
