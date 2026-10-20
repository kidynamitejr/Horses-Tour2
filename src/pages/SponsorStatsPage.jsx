import { useEffect, useState } from "react"
import { getAdvertisements } from "../data/googleSheets"
import { clearAdStats, getAdStats, liveScoringReady } from "../data/liveScoring"

// Sponsor Stats: anonymous view and click counts for each ad, by month and
// all-time, to show sponsors what their spot gets. Views and clicks are
// counted once per visit; nothing about who viewed or clicked is stored.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number)
  return month ? `${MONTHS[month - 1]} ${year}` : key
}

function clickTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function rate(clicks, views) {
  return views ? `${((clicks / views) * 100).toFixed(1)}%` : "-"
}

function SponsorStatsPage() {
  const [rows, setRows] = useState(null)
  const [clicks, setClicks] = useState([])
  const [ads, setAds] = useState([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getAdvertisements().then(setAds).catch(() => {})
    if (!liveScoringReady) return
    getAdStats()
      .then((stats) => {
        setRows(stats.rows)
        setClicks(stats.clicks)
      })
      .catch((err) => setError(err.message || "Couldn't load the stats - try again in a moment."))
  }, [])

  async function clear(ad, title) {
    const what = ad ? `all views and clicks for ${title}` : "ALL sponsor views and clicks"
    if (!window.confirm(`Clear ${what}? This can't be undone.`)) return
    setBusy(true)
    try {
      await clearAdStats(ad)
      setRows((list) => (list || []).filter((r) => ad && r.ad !== ad))
      setClicks((list) => list.filter((c) => ad && c.ad !== ad))
    } catch (err) {
      setError(err.message || "Couldn't clear the stats.")
    } finally {
      setBusy(false)
    }
  }

  const thisMonth = new Date().toISOString().slice(0, 7)

  // One summary per ad, plus its months newest first.
  const byAd = {}
  ;(rows || []).forEach((r) => {
    if (!byAd[r.ad]) byAd[r.ad] = { ad: r.ad, title: r.title, views: 0, clicks: 0, months: [] }
    const entry = byAd[r.ad]
    entry.views += r.views
    entry.clicks += r.clicks
    entry.months.push(r)
    if (r.title) entry.title = r.title
  })
  const summaries = Object.values(byAd)
    .map((s) => {
      const sheetAd = ads.find((a) => String(a["Advertisement #"]).trim() === s.ad)
      return {
        ...s,
        title: (sheetAd?.["Advertisement Title"] || s.title || `Ad ${s.ad}`).trim(),
        image: sheetAd?.["Store Picture Mobile"] || sheetAd?.["Store Picture Desktop"] || "",
        link: sheetAd?.["Store Link"] || "",
        current: s.months.find((m) => m.month === thisMonth) || { views: 0, clicks: 0 },
        recent: clicks.filter((c) => c.ad === s.ad).slice(0, 10),
        months: [...s.months].sort((a, b) => b.month.localeCompare(a.month)),
      }
    })
    .sort((a, b) => Number(a.ad) - Number(b.ad))

  return (
    <div className="sps-page">

      <p className="sps-intro">
        Counted anonymously: one view per visit when a sponsor&apos;s ad is shown, and one click per visit when
        someone taps through (with the time of each click). No names, emails or personal information are collected.
      </p>

      <dl className="sps-help">
        <div><dt>View</dt><dd>Someone visited the site and the sponsor&apos;s ad was shown to them.</dd></div>
        <div><dt>Click</dt><dd>Someone tapped the ad and went to the sponsor&apos;s site or store.</dd></div>
        <div><dt>Click rate</dt><dd>Clicks ÷ views - e.g. 5 clicks from 100 views is 5%. It shows how well the ad gets people to act.</dd></div>
      </dl>

      {error && <p className="sps-empty">{error}</p>}
      {!error && rows === null && liveScoringReady && <p className="sps-empty">Loading stats...</p>}
      {rows && summaries.length === 0 && <p className="sps-empty">No views counted yet - stats start now.</p>}

      {summaries.map((s) => (
        <section key={s.ad} className="sps-card">
          <div className="sps-head">
            {s.image && <img src={s.image} alt="" />}
            <div>
              <span className="sps-eyebrow">Sponsor</span>
              <h2>{s.title}</h2>
              {s.link && (
                <a href={s.link} target="_blank" rel="noopener noreferrer sponsored">Visit sponsor ↗</a>
              )}
            </div>
            <button type="button" className="sps-reset" onClick={() => clear(s.ad, s.title)} disabled={busy}>
              Reset stats
            </button>
          </div>

          <div className="sps-tiles">
            <div><span>Views · all time</span><b>{s.views.toLocaleString()}</b></div>
            <div><span>Clicks · all time</span><b>{s.clicks.toLocaleString()}</b></div>
            <div><span>Click rate</span><b>{rate(s.clicks, s.views)}</b></div>
            <div><span>This month</span><b>{s.current.views} <small>views</small> · {s.current.clicks} <small>clicks</small></b></div>
          </div>

          <div className="sps-clicks">
            <h3>Recent clicks</h3>
            {s.recent.length === 0 ? (
              <p>No clicks logged yet.</p>
            ) : (
              <ol>
                {s.recent.map((c, i) => (
                  <li key={`${c.at}-${i}`}>{clickTime(c.at)}</li>
                ))}
              </ol>
            )}
          </div>

          <table className="sps-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>Click rate</th>
                <th>Last click</th>
              </tr>
            </thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{m.views.toLocaleString()}</td>
                  <td>{m.clicks.toLocaleString()}</td>
                  <td>{rate(m.clicks, m.views)}</td>
                  <td>{m.lastClick ? clickTime(m.lastClick) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {summaries.length > 0 && (
        <button type="button" className="sps-clear-all" onClick={() => clear("", "")} disabled={busy}>
          Clear all sponsor stats
        </button>
      )}

    </div>
  )
}

export default SponsorStatsPage
