import { useEffect, useState } from "react"
import { getAdvertisements } from "../data/googleSheets"
import { getAdStats, liveScoringReady } from "../data/liveScoring"

// Sponsor Stats: anonymous view and click counts for each ad, by month and
// all-time, to show sponsors what their spot gets. Views and clicks are
// counted once per visit; nothing about who viewed or clicked is stored.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number)
  return month ? `${MONTHS[month - 1]} ${year}` : key
}

function rate(clicks, views) {
  return views ? `${((clicks / views) * 100).toFixed(1)}%` : "-"
}

function SponsorStatsPage() {
  const [rows, setRows] = useState(null)
  const [ads, setAds] = useState([])
  const [error, setError] = useState("")

  useEffect(() => {
    getAdvertisements().then(setAds).catch(() => {})
    if (!liveScoringReady) return
    getAdStats()
      .then(setRows)
      .catch((err) => setError(err.message || "Couldn't load the stats - try again in a moment."))
  }, [])

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
        months: [...s.months].sort((a, b) => b.month.localeCompare(a.month)),
      }
    })
    .sort((a, b) => Number(a.ad) - Number(b.ad))

  return (
    <div className="sps-page">

      <p className="sps-intro">
        Counted anonymously: one view per visit when a sponsor&apos;s ad is shown, and one click per visit when
        someone taps through. No names, emails or personal information are collected.
      </p>

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
          </div>

          <div className="sps-tiles">
            <div><span>Views · all time</span><b>{s.views.toLocaleString()}</b></div>
            <div><span>Clicks · all time</span><b>{s.clicks.toLocaleString()}</b></div>
            <div><span>Click rate</span><b>{rate(s.clicks, s.views)}</b></div>
            <div><span>This month</span><b>{s.current.views} <small>views</small> · {s.current.clicks} <small>clicks</small></b></div>
          </div>

          <table className="sps-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>Click rate</th>
              </tr>
            </thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{m.views.toLocaleString()}</td>
                  <td>{m.clicks.toLocaleString()}</td>
                  <td>{rate(m.clicks, m.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

    </div>
  )
}

export default SponsorStatsPage
