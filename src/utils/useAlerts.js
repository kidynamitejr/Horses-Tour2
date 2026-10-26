import { useEffect, useState } from "react"
import { alertsAreOn, alertsSupport, getAlertsConfig, refreshAlerts, turnOffAlerts, turnOnAlerts } from "../data/alerts"

// Shared state for the alerts banner and the Live Scoring page's alerts
// box, so turning alerts on in one updates the other.
const CHANGE_EVENT = "ht-alerts-change"
let refreshed = false

export function useAlerts() {
  const [setup, setSetup] = useState(null)
  const [on, setOn] = useState(alertsAreOn)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const support = alertsSupport()

  useEffect(() => {
    let live = true
    getAlertsConfig().then((s) => {
      if (!live) return
      setSetup(s)
      if (s && !refreshed) {
        refreshed = true
        refreshAlerts(s).catch(() => {})
      }
    })
    const sync = () => setOn(alertsAreOn())
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      live = false
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  async function change(turnOn) {
    setBusy(true)
    setMessage("")
    try {
      if (turnOn) await turnOnAlerts(setup)
      else await turnOffAlerts(setup)
      setOn(turnOn)
      window.dispatchEvent(new Event(CHANGE_EVENT))
      return true
    } catch (err) {
      setMessage(err.message || "Couldn't change alerts.")
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    // Hidden until Firebase is set up in the live scoring script.
    available: Boolean(setup) && support !== "unsupported",
    needsInstall: support === "install",
    on,
    busy,
    message,
    turnOn: () => change(true),
    turnOff: () => change(false),
  }
}
