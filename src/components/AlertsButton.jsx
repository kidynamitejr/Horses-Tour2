import { useState } from "react"
import { BellIcon } from "./Icons"
import { useAlerts } from "../utils/useAlerts"
import { InstallSteps } from "./AlertsPrompt"

// The Live Scoring page's alerts box - where alerts can be turned off too.
function AlertsButton() {
  const alerts = useAlerts()
  const [showHow, setShowHow] = useState(false)
  if (!alerts.available) return null

  return (
    <section className={`alerts-box${alerts.on ? " is-on" : ""}`}>
      <span className="alerts-icon"><BellIcon size={22} /></span>
      <div className="alerts-text">
        <h3>{alerts.on ? "Live alerts are on" : "Get live alerts"}</h3>
        <p>Birdies, lead changes and final cards, sent to this phone as they happen.</p>
      </div>
      {alerts.needsInstall ? (
        <button type="button" className="alerts-btn" onClick={() => setShowHow((v) => !v)}>
          {showHow ? "Hide steps" : "Show me how"}
        </button>
      ) : (
        <button
          type="button"
          className={`alerts-btn${alerts.on ? " is-quiet" : ""}`}
          onClick={alerts.on ? alerts.turnOff : alerts.turnOn}
          disabled={alerts.busy}
        >
          {alerts.busy ? "One moment..." : alerts.on ? "Turn off" : "Turn on alerts"}
        </button>
      )}
      {alerts.needsInstall && showHow && <InstallSteps />}
      {alerts.message && <p className="alerts-msg">{alerts.message}</p>}
    </section>
  )
}

export default AlertsButton
