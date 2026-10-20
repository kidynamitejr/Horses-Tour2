// Shared content for the redesigned layout: stock photography, the photo
// banner shown at the top of each page, and the tour's home courses.

const BASE = import.meta.env.BASE_URL

// Free-to-use photos from Unsplash (unsplash.com/license), served from
// their CDN at the size each spot needs.
function unsplash(id, width = 2000) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=75`
}

export const PHOTOS = {
  aerialFairway: unsplash("photo-1500932334442-8761ee4810a7"),
  sunsetSwing: unsplash("photo-1593282153762-a41e3cceb06c"),
  driverSwing: unsplash("photo-1535131749006-b7f58c99034b", 1400),
  followThrough: unsplash("photo-1611374243147-44a702c2d44c", 1400),
  sunsetCourse: unsplash("photo-1709525616662-8d9f9a995ceb"),
  golfersToast: unsplash("photo-1629673120178-53a664eec9e8"),
  aerialGreen: unsplash("photo-1605144884374-ecbb643615f6"),
  treeLinedCourse: unsplash("photo-1760926606923-b163c4c8f9ff"),
  bunkerSunrise: unsplash("photo-1538648759472-7251f7cb2c2f"),
  courseOverlook: unsplash("photo-1592937238247-cd0090e02f65"),
  putting: unsplash("photo-1532508583690-538a1436f423"),
  ballOnTee: unsplash("photo-1562204320-31975a5e09ce"),
  ballAtCup: unsplash("photo-1587174486073-ae5e5cff23aa"),
  wedgeAndBall: unsplash("photo-1593111774240-d529f12cf4bb"),
  golfCarts: unsplash("photo-1561251224-e393160cd769", 1400),
  flagAndBall: unsplash("photo-1632946269126-0f8edbe8b068", 1400),
}

export const LOGO = `${BASE}images/logo/horses-tour-logo.png`

export const COURSES = [
  { name: "J.S. Clark", image: `${BASE}images/courses/j-s-clark.jpg` },
  { name: "Santa Maria", image: `${BASE}images/courses/santa-maria.jpeg` },
  { name: "City Park", image: `${BASE}images/courses/city-park.jpg` },
  { name: "Copper Mill", image: `${BASE}images/courses/copper-mill.jpg` },
  { name: "Oak Knoll", image: `${BASE}images/courses/oak-knoll.jpg` },
  { name: "Beaver Creek", image: `${BASE}images/courses/beaver-creek.webp` },
  { name: "The Island", image: `${BASE}images/courses/the-island.jpeg` },
]

// Live scoring web app (Google Apps Script - see scripts/live-scoring.gs).
export const LIVE_SCORING_URL =
  "https://script.google.com/macros/s/AKfycbyl5PTgyfjfhu3Mq01EmbWQCaqzkkmNFsrqZYwbA97c7UWkfUdVDhSFuLlFJYd82z6N/exec"

// Logos for players' home courses (profiles, player cards, compare page,
// trading card), keyed by the Players tab's Home Course (case and words
// like "Golf Course" don't matter). Without an entry, a generated crest
// with the course's initials is used. To add one: put a transparent PNG in public/images/course-logos/
// and add a line here. Logos with dark lettering also have a "-dark" file
// (light lettering) for the dark grey profile header.
const courseLogo = (file, hasDarkVersion = false) => ({
  src: `${BASE}images/course-logos/${file}.png`,
  dark: `${BASE}images/course-logos/${file}${hasDarkVersion ? "-dark" : ""}.png`,
})

export const COURSE_LOGOS = {
  "Copper Mill Golf Course": courseLogo("copper-mill", true),
  "Greystone Golf & Country Club": courseLogo("greystone", true),
  "J.S. Clark Golf Course": courseLogo("js-clark", true),
  "The Pines at North Park": courseLogo("the-pines", true),
  "City Park Golf Course": courseLogo("city-park", true),
  "Bayou Oaks at City Park": courseLogo("bayou-oaks", true),
  "Webb Memorial Golf Course": courseLogo("webb-memorial", true),
  "Oak Lake": courseLogo("oak-lake", true),
  "Carter Plantation": courseLogo("carter-plantation"),
  "Beaver Creek Golf Course": courseLogo("beaver-creek"),
}

// Per-player logo, for players whose Home Course name is shared by two
// courses. Keyed by Player ID. (Adam's "City Park" is Bayou Oaks.)
export const PLAYER_COURSE_LOGOS = {
  6: courseLogo("bayou-oaks", true),
}

// "Oak Lake Golf Course", "Oak Lake" and "oak lake golf club" all count as
// the same course - filler words, punctuation and case are ignored.
const FILLER_WORDS = new Set(["golf", "course", "club", "country", "and", "the", "at", "cc", "gc"])

function courseKey(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join(" ")
}

export function findCourseLogo(course, playerId) {
  if (playerId != null && PLAYER_COURSE_LOGOS[playerId]) return PLAYER_COURSE_LOGOS[playerId]
  const key = courseKey(course)
  if (!key) return null
  const match = Object.keys(COURSE_LOGOS).find((name) => courseKey(name) === key)
  return match ? COURSE_LOGOS[match] : null
}

// Main header links - everything else lives under "More".
export const PRIMARY_NAV = [
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/schedule", label: "Schedule" },
  { to: "/players", label: "Players" },
  { to: "/stats", label: "Stats" },
  { to: "/news", label: "News" },
]

export const MORE_NAV = [
  { to: "/live", label: "Live Scoring", note: "Scorecards and the live leaderboard" },
  { to: "/past-matches", label: "Past Matches", note: "Every result, round by round" },
  { to: "/course-history", label: "Course History", note: "Hole-by-hole scoring" },
  { to: "/hall-of-champions", label: "Hall of Champions", note: "Every champion crowned" },
  { to: "/gallery", label: "Gallery", note: "Photos from the tour" },
  { to: "/compare-players", label: "Compare Players", note: "Head-to-head numbers" },
  { to: "/calculator", label: "Points Calculator", note: "How points are earned" },
  { to: "/auto-matchmaking", label: "Auto Matchmaking", note: "Pair the next event's teams" },
  { to: "/sponsor-stats", label: "Sponsor Stats", note: "Ad views and clicks" },
  { to: "/rules", label: "Rules", note: "Format and competition rules" },
]

export const PAGE_HEROES = {
  "/leaderboard": {
    eyebrow: "Standings",
    title: "Leaderboard",
    subtitle: "Track standings, points, and the championship race.",
    image: PHOTOS.driverSwing,
  },
  "/schedule": {
    eyebrow: "2026 Season",
    title: "Tour Schedule",
    subtitle: "Upcoming events, tee times, and tournament information.",
    image: PHOTOS.sunsetCourse,
  },
  "/players": {
    eyebrow: "The Field",
    title: "Players",
    subtitle: "Meet the competitors of the Horses Tour.",
    image: PHOTOS.golfersToast,
  },
  "/stats": {
    eyebrow: "By the Numbers",
    title: "Statistics",
    subtitle: "Performance data, player insights and team stats from across the season.",
    image: PHOTOS.aerialGreen,
  },
  "/gallery": {
    eyebrow: "Moments",
    title: "Gallery",
    subtitle: "Photos and memories from Horses Tour events.",
    image: PHOTOS.treeLinedCourse,
  },
  "/news": {
    eyebrow: "Tour Media",
    title: "News",
    subtitle: "Latest updates and announcements from the tour.",
    image: PHOTOS.courseOverlook,
  },
  "/past-matches": {
    eyebrow: "Results",
    title: "Past Matches",
    subtitle: "Review previous competitions and results.",
    image: PHOTOS.putting,
  },
  "/rules": {
    eyebrow: "Competition",
    title: "Rules",
    subtitle: "Everything you need to know about Horses Tour competition.",
    image: PHOTOS.ballOnTee,
  },
  "/calculator": {
    eyebrow: "Scoring",
    title: "Points Calculator",
    subtitle: "Calculate player points for a completed event.",
    image: PHOTOS.wedgeAndBall,
  },
  "/compare-players": {
    eyebrow: "Head to Head",
    title: "Compare Players",
    subtitle: "See how any two players stack up head-to-head.",
    image: PHOTOS.followThrough,
  },
  "/hall-of-champions": {
    eyebrow: "Legacy",
    title: "Hall of Champions",
    subtitle: "Every champion crowned across Horses Tour history.",
    image: PHOTOS.ballAtCup,
  },
  "/live": {
    eyebrow: "On the Course",
    title: "Live Scoring",
    subtitle: "Follow every team hole by hole, and keep your own card.",
    image: PHOTOS.flagAndBall,
  },
  "/sponsor-stats": {
    eyebrow: "Partners",
    title: "Sponsor Stats",
    subtitle: "How many people saw and clicked each sponsor - counted anonymously.",
    image: PHOTOS.courseOverlook,
  },
  "/auto-matchmaking": {
    eyebrow: "Next Event",
    title: "Auto Matchmaking",
    subtitle: "Mark who's playing and the teams pair themselves - first with last, second with second to last.",
    image: PHOTOS.golfCarts,
  },
  "/course-history": {
    eyebrow: "Course Intelligence",
    title: "Course History",
    subtitle: "Hole-by-hole scoring from every match on the tour.",
    image: PHOTOS.bunkerSunrise,
  },
}
