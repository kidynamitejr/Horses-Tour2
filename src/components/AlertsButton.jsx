import { useEffect, useState } from "react"
import { alertsAreOn, alertsSupport, getAlertsConfig, refreshAlerts, turnOffAlerts, turnOnAlerts } from "../data/alerts"

// "Turn on alerts" for birdies, lead changes and final cards. Hidden
// until Firebase is set up in the live scoring script.
function AlertsButton() {
  const [setup, setSetup] = useState(null)
  const [on, setOn] = useState(alertsAreOn)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [showHow, setShowHow] = useState(false)
  const support = alertsSupport()

  useEffect(() => {
    let live = true
    getAlertsConfig().then((s) => {
      if (!live) return
      setSetup(s)
      if (s) refreshAlerts(s).catch(() => {})
    })
    return () => {
      live = false
    }
  }, [])

  if (!setup || support === "unsupported") return null

  async function toggle() {
    setBusy(true)
    setMessage("")
    try {
      if (on) {
        await turnOffAlerts(setup)
        setOn(false)
        setMessage("Alerts are off.")
      } else {
        await turnOnAlerts(setup)
        setOn(true)
        setMessage("You're in - you'll get birdies, lead changes and final cards.")
      }
    } catch (err) {
      setMessage(err.message || "Couldn't change alerts.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="alerts-box">
      <div className="alerts-text">
        <h3>{on ? "🔔 Alerts are on" : "🔔 Get live alerts"}</h3>
        <p>Birdies, lead changes and final cards, sent to your phone as they happen. No account needed.</p>
      </div>
      {support === "install" ? (
        <button type="button" className="alerts-btn" onClick={() => setShowHow((v) => !v)}>
          How to turn on alerts
        </button>
      ) : (
        <button type="button" className={`alerts-btn${on ? " is-on" : ""}`} onClick={toggle} disabled={busy}>
          {busy ? "One moment..." : on ? "Turn off alerts" : "Turn on alerts"}
        </button>
      )}
      {support === "install" && showHow && (
        <ol className="alerts-how">
          <li>Tap the <b>Share</b> button at the bottom of Safari.</li>
          <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open <b>Horses Tour</b> from your home screen and tap <b>Turn on alerts</b> here.</li>
        </ol>
      )}
      {message && <p className="alerts-msg">{message}</p>}
    </section>
  )
}

export default AlertsButton
