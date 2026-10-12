// Free, no-API-key weather for the next event's course. Geocoding is via
// OpenStreetMap's Nominatim (address -> lat/lon), and the forecast itself
// is via Open-Meteo - both work directly from the browser with no signup
// or secret to manage, which matters since this site has no backend to
// hide a key behind.

const WEATHER_CODE_INFO = {
  0: { icon: "☀️", label: "Clear" },
  1: { icon: "🌤️", label: "Mostly Clear" },
  2: { icon: "⛅", label: "Partly Cloudy" },
  3: { icon: "☁️", label: "Cloudy" },
  45: { icon: "🌫️", label: "Fog" },
  48: { icon: "🌫️", label: "Fog" },
  51: { icon: "🌦️", label: "Light Drizzle" },
  53: { icon: "🌦️", label: "Drizzle" },
  55: { icon: "🌧️", label: "Heavy Drizzle" },
  56: { icon: "🌧️", label: "Freezing Drizzle" },
  57: { icon: "🌧️", label: "Freezing Drizzle" },
  61: { icon: "🌦️", label: "Light Rain" },
  63: { icon: "🌧️", label: "Rain" },
  65: { icon: "🌧️", label: "Heavy Rain" },
  66: { icon: "🌧️", label: "Freezing Rain" },
  67: { icon: "🌧️", label: "Freezing Rain" },
  71: { icon: "🌨️", label: "Light Snow" },
  73: { icon: "🌨️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy Snow" },
  77: { icon: "❄️", label: "Snow Grains" },
  80: { icon: "🌦️", label: "Rain Showers" },
  81: { icon: "🌧️", label: "Rain Showers" },
  82: { icon: "⛈️", label: "Violent Showers" },
  85: { icon: "🌨️", label: "Snow Showers" },
  86: { icon: "🌨️", label: "Snow Showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Thunderstorm" },
  99: { icon: "⛈️", label: "Severe Thunderstorm" },
}

function getWeatherInfo(code) {
  return WEATHER_CODE_INFO[code] || { icon: "🌡️", label: "" }
}

// Geocoding hits an external service on every unique address, so cache
// results for the life of the page instead of re-resolving the same
// course address over and over.
const geocodeCache = {}

async function geocodeAddress(address) {

  if (geocodeCache[address]) return geocodeCache[address]

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`

  const response = await fetch(url)

  if (!response.ok) return null

  const data = await response.json()

  if (!data || data.length === 0) return null

  const location = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }

  geocodeCache[address] = location

  return location

}

// Schedule/Events dates are "M/D/YY" (e.g. "9/27/26") - converted to an
// ISO "YYYY-MM-DD" for the weather API.
function toISODate(dateStr) {

  const parts = (dateStr || "").split("/")

  if (parts.length !== 3) return null

  const [m, d, y] = parts
  const year = y.length === 2 ? `20${y}` : y

  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`

}

// Everything after the street portion (city, state, zip) - used to build
// a looser fallback query when the full address doesn't geocode.
function extractCityState(address) {

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean)

  if (parts.length < 2) return ""

  return parts.slice(1).join(", ")

}

// Tries the exact address first, then falls back to looser queries built
// from the course name - a street address can fail to geocode over a
// small wording difference (e.g. the sheet says "Coppermill" as one word
// while OpenStreetMap has the road as "Copper Mill", two words) even
// though the venue itself is easy to find by name.
async function geocodeEvent(address, courseName) {

  if (address) {

    const direct = await geocodeAddress(address)

    if (direct) return direct

  }

  if (!courseName) return null

  const cityState = address ? extractCityState(address) : ""

  const attempts = cityState
    ? [`${courseName} Golf Course, ${cityState}`, `${courseName}, ${cityState}`]
    : [`${courseName} Golf Course`]

  for (const query of attempts) {

    const location = await geocodeAddress(query)

    if (location) return location

  }

  return null

}

// Returns null if there's nothing to geocode, the date can't be parsed,
// the event is too far out for a forecast to exist yet (~16 days), or
// either API call fails - the widget just doesn't render rather than
// erroring.
export async function getEventForecast(address, dateStr, courseName) {

  if (!address && !courseName) return null

  const iso = toISODate(dateStr)

  if (!iso) return null

  const eventDate = new Date(iso)

  if (isNaN(eventDate)) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysAway = Math.round((eventDate - today) / (1000 * 60 * 60 * 24))

  if (daysAway < 0 || daysAway > 15) return null

  try {

    const location = await geocodeEvent(address, courseName)

    if (!location) return null

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${iso}&end_date=${iso}`

    const response = await fetch(url)

    if (!response.ok) return null

    const data = await response.json()

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) return null

    const info = getWeatherInfo(data.daily.weathercode[0])

    return {
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
      precipChance: data.daily.precipitation_probability_max[0],
      icon: info.icon,
      label: info.label,
    }

  } catch (error) {

    console.error("Weather Forecast Error:", error)
    return null

  }

}
