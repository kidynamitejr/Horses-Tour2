import { useState } from "react"
import AutoMatchmakingPage from "./AutoMatchmakingPage"
import SponsorStatsPage from "./SponsorStatsPage"
import NewsAdmin from "../components/NewsAdmin"
import GalleryAdmin from "../components/GalleryAdmin"
import RoundAdmin from "../components/admin/RoundAdmin"
import EventsAdmin from "../components/admin/EventsAdmin"
import ChampionsAdmin from "../components/admin/ChampionsAdmin"
import PlayersAdmin from "../components/admin/PlayersAdmin"
import RulesAdmin from "../components/admin/RulesAdmin"
import AnnouncementsAdmin from "../components/admin/AnnouncementsAdmin"
import AwardsAdmin from "../components/admin/AwardsAdmin"
import { adminSignIn, adminSignOut, getAdminPassword, liveScoringReady } from "../data/liveScoring"

// Admin: the commissioner's tools behind a password - matchmaking, the
// round dashboard and scorecard fixes, events (and course pars), awarded
// power points, the
// Hall of Champions, players,
// sponsors, news, gallery, rules, the announcement banner and phone
// notifications. The password is checked by the Google Apps
// Script on every admin action, so it isn't stored in this public code.

const TABS = [
  { id: "matchmaking", label: "Auto Matchmaking" },
  { id: "round", label: "Round" },
  { id: "events", label: "Events" },
  { id: "awards", label: "Award Points" },
  { id: "champions", label: "Champion Hall" },
  { id: "players", label: "Players" },
  { id: "sponsors", label: "Sponsors" },
  { id: "news", label: "News" },
  { id: "gallery", label: "Gallery" },
  { id: "rules", label: "Rules" },
  { id: "announcements", label: "Banner & Notifications" },
]

function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminPassword()))
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ht-admin-tab") || "matchmaking"
      // The Banner and Notifications tabs are now one.
      return saved === "banner" || saved === "notifications" ? "announcements" : saved
    } catch {
      return "matchmaking"
    }
  })

  async function signIn(e) {
    e.preventDefault()
    setChecking(true)
    setError("")
    try {
      await adminSignIn(password)
      setPassword("")
      setSignedIn(true)
    } catch (err) {
      setError(/unknown action/i.test(err.message) ? "Update the Google Apps Script to turn on Admin." : err.message)
    } finally {
      setChecking(false)
    }
  }

  function signOut() {
    adminSignOut()
    setSignedIn(false)
  }

  function pickTab(id) {
    setTab(id)
    try {
      sessionStorage.setItem("ht-admin-tab", id)
    } catch {
      // Not remembered - fine.
    }
  }

  if (!liveScoringReady) {
    return <p className="adm-note">Admin needs live scoring connected to the Google Sheet.</p>
  }

  if (!signedIn) {
    return (
      <form className="adm-login" onSubmit={signIn}>
        <span className="adm-lock" aria-hidden="true">🔒</span>
        <h2>Admin sign-in</h2>
        <p>Commissioner tools: matchmaking, sponsor stats and news.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          aria-label="Admin password"
        />
        <button type="submit" disabled={!password || checking}>{checking ? "Checking..." : "Sign in"}</button>
        {error && <p className="adm-error">{error}</p>}
      </form>
    )
  }

  return (
    <div className="adm">
      <div className="adm-bar">
        <div className="adm-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => pickTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select className="adm-tab-select" value={tab} onChange={(e) => pickTab(e.target.value)} aria-label="Admin section">
          {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button type="button" className="adm-signout" onClick={signOut}>Sign out</button>
      </div>

      <div className="adm-panel" role="tabpanel">
        {tab === "matchmaking" && <AutoMatchmakingPage />}
        {tab === "round" && <RoundAdmin />}
        {tab === "events" && <EventsAdmin />}
        {tab === "awards" && <AwardsAdmin />}
        {tab === "champions" && <ChampionsAdmin />}
        {tab === "players" && <PlayersAdmin />}
        {tab === "sponsors" && <SponsorStatsPage />}
        {tab === "news" && <NewsAdmin />}
        {tab === "gallery" && <GalleryAdmin />}
        {tab === "rules" && <RulesAdmin />}
        {tab === "announcements" && <AnnouncementsAdmin />}
      </div>
    </div>
  )
}

export default AdminPage
