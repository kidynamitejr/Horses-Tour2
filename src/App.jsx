import "./App.css"
import "./theme.css"
import "./profile.css"
import "./cards.css"
import "./compare.css"
import "./gallery.css"
import "./rules.css"
import "./leaderboard.css"
import "./schedule.css"
import "./live.css"
import "./matchmaking.css"
import "./sponsor.css"
import "./mobile.css"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"

import Header from "./components/Header"
import Hero from "./components/Hero"
import Footer from "./components/Footer"
import AdvertisementBanner from "./components/AdvertisementBanner"
import { PAGE_HEROES } from "./siteConfig"

import Home from "./pages/Home"
import LeaderboardPage from "./pages/LeaderboardPage"
import SchedulePage from "./pages/SchedulePage"
import PlayersPage from "./pages/PlayersPage"
import StatsPage from "./pages/StatsPage"
import GalleryPage from "./pages/GalleryPage"
import NewsPage from "./pages/NewsPage"
import PastMatchesPage from "./pages/PastMatchesPage"
import RulesPage from "./pages/RulesPage"
import PlayerProfile from "./pages/PlayerProfile"
import ArticlePage from "./pages/ArticlePage"
import PointsCalculatorPage from "./pages/PointsCalculatorPage"
import ComparePlayersPage from "./pages/ComparePlayersPage"
import HallOfChampionsPage from "./pages/HallOfChampionsPage"
import CourseHistoryPage from "./pages/CourseHistoryPage"
import NextEventPage from "./pages/NextEventPage"
import LiveScoringPage from "./pages/LiveScoringPage"
import LiveScorecardPage from "./pages/LiveScorecardPage"
import AutoMatchmakingPage from "./pages/AutoMatchmakingPage"
import SponsorStatsPage from "./pages/SponsorStatsPage"

function getPageHero(pathname) {
  if (PAGE_HEROES[pathname]) return PAGE_HEROES[pathname]
  if (pathname.startsWith("/news/")) return PAGE_HEROES["/news"]
  // Player profiles and the Next Event page already open with their own
  // photo banner.
  return null
}

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === "/"
  const pageHero = getPageHero(location.pathname)

  return (
    <div className={`website${isHome ? " is-home" : ""}`}>
      <Header />

      {!isHome && pageHero && <Hero {...pageHero} />}

      <main className={isHome ? "main main-home" : pageHero ? "main" : "main main-no-hero"}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/leaderboard" element={<LeaderboardPage />} />

          <Route path="/schedule" element={<SchedulePage />} />

          <Route path="/players" element={<PlayersPage />} />

          <Route path="/stats" element={<StatsPage />} />

          <Route path="/gallery" element={<GalleryPage />} />

          <Route path="/news" element={<NewsPage />} />

          <Route path="/news/:id" element={<ArticlePage />} />

          <Route path="/past-matches" element={<PastMatchesPage />} />

          <Route path="/rules" element={<RulesPage />} />

          <Route path="/calculator" element={<PointsCalculatorPage />} />

          <Route path="/compare-players" element={<ComparePlayersPage />} />

          <Route path="/hall-of-champions" element={<HallOfChampionsPage />} />

          <Route path="/course-history" element={<CourseHistoryPage />} />

          <Route path="/next-event" element={<NextEventPage />} />

          <Route path="/live" element={<LiveScoringPage />} />

          <Route path="/live/:eventId/:team" element={<LiveScorecardPage />} />

          <Route path="/auto-matchmaking" element={<AutoMatchmakingPage />} />

          <Route path="/sponsor-stats" element={<SponsorStatsPage />} />

          <Route
            path="/player-profile/:name"
            element={<PlayerProfile />}
          />
        </Routes>
      </main>

      <Footer />

      <AdvertisementBanner />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout />
    </BrowserRouter>
  )
}

export default App
