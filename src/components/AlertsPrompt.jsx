import { useEffect, useState } from "react"
import { BellIcon } from "./Icons"
import { useAlerts } from "../utils/useAlerts"

// Drops down under the header on every page until this phone turns alerts
// on. "Not now" hides it for a few days.
const SNOOZE_KEY = "ht-alerts-snoozed"
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

function snoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_MS
  } catch {
    return false
  }
}

export function InstallSteps() {
  return (
    <ol className="alerts-how">
      <li>Tap <b>Share</b> at the bottom of Safari.</li>
      <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open <b>Horses Tour</b> from your home screen and turn on alerts there.</li>
    </ol>
  )
}

function AlertsPrompt() {
  const alerts = useAlerts()
  const [hidden, setHidden] = useState(snoozed)
  const [ready, setReady] = useState(false)
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)
  const [showHow, setShowHow] = useState(false)

  // A short pause so it drops in after the page has loaded.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  if (!alerts.available || hidden || !ready || (alerts.on && !done)) return null

  function close(snooze) {
    if (snooze) {
      try {
        localStorage.setItem(SNOOZE_KEY, String(Date.now()))
      } catch {
        // Not remembered - it'll show again next visit.
      }
    }
    setClosing(true)
    setTimeout(() => setHidden(true), 250)
  }

  async function turnOn() {
    if (await alerts.turnOn()) {
      setDone(true)
      setTimeout(() => close(false), 2500)
    }
  }

  return (
    <div className={`alerts-prompt${closing ? " is-closing" : ""}`} role="dialog" aria-label="Live alerts">
      <button type="button" className="alerts-prompt-x" onClick={() => close(true)} aria-label="Close">×</button>
      <span className="alerts-prompt-icon"><BellIcon size={24} /></span>
      <div className="alerts-prompt-body">
        {done ? (
          <>
            <strong>You're all set</strong>
            <p>We'll let you know about birdies, lead changes and final cards.</p>
          </>
        ) : (
          <>
            <span className="alerts-prompt-eyebrow">Horses Tour Live</span>
            <strong>Never miss a birdie</strong>
            <p>Get a heads-up on birdies, lead changes and final cards while the round is on. No account needed.</p>
            {alerts.needsInstall && showHow && <InstallSteps />}
            {alerts.message && <p className="alerts-prompt-error">{alerts.message}</p>}
            <div className="alerts-prompt-actions">
              {alerts.needsInstall ? (
                <button type="button" className="alerts-prompt-yes" onClick={() => setShowHow((v) => !v)}>
                  {showHow ? "Got it" : "Show me how"}
                </button>
              ) : (
                <button type="button" className="alerts-prompt-yes" onClick={turnOn} disabled={alerts.busy}>
                  {alerts.busy ? "Turning on..." : "Turn on alerts"}
                </button>
              )}
              <button type="button" className="alerts-prompt-no" onClick={() => close(true)}>Not now</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AlertsPrompt
