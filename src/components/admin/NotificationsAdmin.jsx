import { useEffect, useState } from "react"
import { getAlertsStatus, sendNotification } from "../../data/liveScoring"
import { BellIcon } from "../Icons"

// Admin > Notifications: write an alert and send it to every phone that
// has alerts turned on (e.g. "Tee times moved to 1:30").

const LINKS = [
  { value: "/live", label: "Live Scoring" },
  { value: "/", label: "Home" },
  { value: "/schedule", label: "Schedule" },
  { value: "/leaderboard", label: "Leaderboard" },
  { value: "/news", label: "News" },
  { value: "custom", label: "Another link..." },
]

function NotificationsAdmin() {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [link, setLink] = useState("/live")
  const [customLink, setCustomLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  function loadStatus() {
    return getAlertsStatus()
      .then((s) => {
        setStatus(s)
        setStatusError("")
      })
      .catch((err) => setStatusError(err.message || "Couldn't check alerts."))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const ready = status && !status.problems.length
  const phones = status?.phones || 0

  async function send() {
    if (!window.confirm(`Send "${title.trim()}" to ${phones} phone${phones === 1 ? "" : "s"}? This can't be undone.`)) return
    setBusy(true)
    setMessage("")
    try {
      const result = await sendNotification({
        title: title.trim(),
        body: body.trim(),
        link: link === "custom" ? customLink.trim() : link,
      })
      setMessage(`Sent to ${result.sent} phone${result.sent === 1 ? "" : "s"}.`)
      setTitle("")
      setBody("")
      loadStatus()
    } catch (err) {
      setMessage(err.message || "Couldn't send the notification.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bna nta">
      <h3>Send a notification</h3>
      <p className="adx-muted">
        Goes straight to every phone that turned on alerts. Birdies, lead changes and final cards are still sent automatically.
      </p>

      <div className={`nta-status${ready ? " is-ready" : status ? " is-problem" : ""}`}>
        {!status && !statusError && "Checking alerts setup..."}
        {statusError && <>⚠ {statusError}</>}
        {ready && <>● Alerts are working · <b>{phones}</b> phone{phones === 1 ? "" : "s"} signed up</>}
        {status && !ready && (
          <>
            <b>Alerts aren't set up yet.</b> Fix this in Apps Script &gt; Project Settings &gt; Script Properties:
            <ul>{status.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </>
        )}
      </div>

      <div className="nta-preview" aria-label="Preview">
        <span className="nta-preview-icon"><BellIcon size={18} /></span>
        <div>
          {title.trim() && <strong>{title.trim()}</strong>}
          {body.trim() && <p>{body.trim()}</p>}
          {!title.trim() && !body.trim() && <p className="nta-preview-empty">Your notification will look like this.</p>}
        </div>
      </div>

      <label className="af-field af-wide">
        <span>Title</span>
        <input type="text" value={title} maxLength={60} placeholder="⛳ Tee times moved to 1:30" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="af-field af-wide">
        <span>Message (optional)</span>
        <textarea rows={3} value={body} maxLength={180} placeholder="Rain this morning - see everyone at Santa Maria at 1:30." onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="af-field af-wide">
        <span>Tapping it opens</span>
        <select value={link} onChange={(e) => setLink(e.target.value)}>
          {LINKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      {link === "custom" && (
        <label className="af-field af-wide">
          <span>Link</span>
          <input type="text" value={customLink} placeholder="https://... or /players" onChange={(e) => setCustomLink(e.target.value)} />
        </label>
      )}

      <div className="adx-actions">
        <button type="button" className="adx-save" onClick={send} disabled={busy || !ready || !phones || !title.trim()}>
          {busy ? "Sending..." : "Send notification"}
        </button>
        <span className="adx-message">{message || (ready && !phones ? "No phones have alerts on yet." : "")}</span>
      </div>
    </div>
  )
}

export default NotificationsAdmin
