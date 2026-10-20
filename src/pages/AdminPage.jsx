import { useState } from "react"
import AutoMatchmakingPage from "./AutoMatchmakingPage"
import SponsorStatsPage from "./SponsorStatsPage"
import NewsAdmin from "../components/NewsAdmin"
import { adminSignIn, adminSignOut, getAdminPassword, liveScoringReady } from "../data/liveScoring"

// Admin: the commissioner's tools behind a password - Auto Matchmaking,
// Sponsor Stats and News. The password is checked by the Google Apps
// Script on every admin action, so it isn't stored in this public code.

const TABS = [
  { id: "matchmaking", label: "Auto Matchmaking" },
  { id: "sponsors", label: "Sponsor Stats" },
  { id: "news", label: "News" },
]

function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminPassword()))
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem("ht-admin-tab") || "matchmaking"
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
        <button type="button" className="adm-signout" onClick={signOut}>Sign out</button>
      </div>

      <div className="adm-panel" role="tabpanel">
        {tab === "matchmaking" && <AutoMatchmakingPage />}
        {tab === "sponsors" && <SponsorStatsPage />}
        {tab === "news" && <NewsAdmin />}
      </div>
    </div>
  )
}

export default AdminPage
