import { useState } from "react"
import AutoMatchmakingPage from "./AutoMatchmakingPage"
import SponsorStatsPage from "./SponsorStatsPage"
import MediaAdmin from "../components/admin/MediaAdmin"
import RoundAdmin from "../components/admin/RoundAdmin"
import EventsAdmin from "../components/admin/EventsAdmin"
import ChampionsAdmin from "../components/admin/ChampionsAdmin"
import PlayersAdmin from "../components/admin/PlayersAdmin"
import RulesAdmin from "../components/admin/RulesAdmin"
import AnnouncementsAdmin from "../components/admin/AnnouncementsAdmin"
import AwardsAdmin from "../components/admin/AwardsAdmin"
import {
  BellIcon, BookIcon, CalendarIcon, ChevronDownIcon, DollarIcon, FlagIcon, LogoutIcon,
  NewspaperIcon, ShieldIcon, SwapIcon, TargetIcon, TrophyIcon, UsersIcon,
} from "../components/Icons"
import { adminSignIn, adminSignOut, getAdminPassword, liveScoringReady } from "../data/liveScoring"

// Admin: the commissioner's tools behind a password - matchmaking, the
// round dashboard and scorecard fixes, events (and course pars), awarded
// power points, the
// Hall of Champions, players,
// sponsors, news, gallery, rules, the announcement banner and phone
// notifications. The password is checked by the Google Apps
// Script on every admin action, so it isn't stored in this public code.

// Sections, grouped in the side menu (and the dropdown on phones).
const GROUPS = [
  {
    label: "Event day",
    tabs: [
      { id: "matchmaking", label: "Auto Matchmaking", icon: SwapIcon },
      { id: "round", label: "Round", icon: FlagIcon },
      { id: "events", label: "Events", icon: CalendarIcon },
      { id: "awards", label: "Award Points", icon: TargetIcon },
    ],
  },
  {
    label: "The tour",
    tabs: [
      { id: "players", label: "Players", icon: UsersIcon },
      { id: "champions", label: "Champion Hall", icon: TrophyIcon },
      { id: "rules", label: "Rules", icon: BookIcon },
    ],
  },
  {
    label: "Media & messages",
    tabs: [
      { id: "media", label: "News & Gallery", icon: NewspaperIcon },
      { id: "announcements", label: "Banner & Notifications", icon: BellIcon },
    ],
  },
  {
    label: "Business",
    tabs: [
      { id: "sponsors", label: "Sponsors", icon: DollarIcon },
    ],
  },
]

const TABS = GROUPS.flatMap((g) => g.tabs.map((t) => ({ ...t, group: g.label })))

function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminPassword()))
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ht-admin-tab") || "matchmaking"
      // Tabs that were merged into one.
      if (saved === "banner" || saved === "notifications") return "announcements"
      if (saved === "news" || saved === "gallery") return "media"
      return TABS.some((t) => t.id === saved) ? saved : "matchmaking"
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

  const current = TABS.find((t) => t.id === tab) || TABS[0]

  return (
    <div className="adm">
      <nav className="adm-nav" aria-label="Admin sections">
        <div className="adm-nav-head">
          <span className="adm-nav-badge"><ShieldIcon size={20} /></span>
          <span>
            <b>Commissioner</b>
            <small>Signed in</small>
          </span>
        </div>
        <div className="adm-nav-groups">
          {GROUPS.map((g) => (
            <div key={g.label} className="adm-nav-group">
              <span>{g.label}</span>
              {g.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "active" : ""}
                  aria-current={tab === t.id ? "page" : undefined}
                  onClick={() => pickTab(t.id)}
                >
                  <t.icon size={18} />
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="adm-signout" onClick={signOut}>
          <LogoutIcon size={16} /> <span>Sign out</span>
        </button>
      </nav>

      <div className="adm-main">
        <div className="adm-picker">
          <label className="adm-picker-current">
            <span className="adm-title-icon"><current.icon size={18} /></span>
            <span className="adm-picker-text">
              <small>{current.group}</small>
              <b>{current.label}</b>
            </span>
            <ChevronDownIcon size={18} />
            <select value={tab} onChange={(e) => pickTab(e.target.value)} aria-label="Admin section">
              {GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" className="adm-signout" onClick={signOut} aria-label="Sign out">
            <LogoutIcon size={16} /> <span>Sign out</span>
          </button>
        </div>

        <div className="adm-title">
          <span className="adm-title-icon"><current.icon size={20} /></span>
          <div>
            <small>{current.group}</small>
            <h2>{current.label}</h2>
          </div>
        </div>

        <div className="adm-panel" role="tabpanel">
          {tab === "matchmaking" && <AutoMatchmakingPage />}
          {tab === "round" && <RoundAdmin />}
          {tab === "events" && <EventsAdmin />}
          {tab === "awards" && <AwardsAdmin />}
          {tab === "champions" && <ChampionsAdmin />}
          {tab === "players" && <PlayersAdmin />}
          {tab === "sponsors" && <SponsorStatsPage />}
          {tab === "media" && <MediaAdmin />}
          {tab === "rules" && <RulesAdmin />}
          {tab === "announcements" && <AnnouncementsAdmin />}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
