import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import html2canvas from "html2canvas"
import { formatCurrency } from "../utils/winnings"

function TradingCardModal({ player, stats, onClose }) {

  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {

    if (!cardRef.current) return

    setDownloading(true)

    try {

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      })

      const link = document.createElement("a")
      link.download = `${player.Name.replace(/\s+/g, "-").toLowerCase()}-trading-card.png`
      link.href = canvas.toDataURL("image/png")
      link.click()

    } catch (error) {

      console.error("Trading Card Download Error:", error)

    } finally {

      setDownloading(false)

    }

  }

  return createPortal(

    <div className="next-event-modal-overlay" onClick={onClose}>

      <div className="next-event-modal trading-card-modal" onClick={(e) => e.stopPropagation()}>

        <button
          type="button"
          className="next-event-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="trading-card" ref={cardRef}>

          <div className="trading-card-header">
            <span className="trading-card-brand">HORSES TOUR</span>
          </div>

          <div className="trading-card-photo-wrap">
            <img
              src={`${import.meta.env.BASE_URL}images/players/${player["Player ID"]}.jpg`}
              alt={player.Name}
              className="trading-card-photo"
              crossOrigin="anonymous"
              onError={(e) => {
                e.target.src = `${import.meta.env.BASE_URL}images/players/default.jpg`
              }}
            />
          </div>

          <h3 className="trading-card-name">{player.Name}</h3>

          <div className="trading-card-stats">

            <div className="trading-card-stat">
              <span className="trading-card-stat-value">{stats.rank ?? "-"}</span>
              <span className="trading-card-stat-label">Rank</span>
            </div>

            <div className="trading-card-stat">
              <span className="trading-card-stat-value">{stats.wins ?? 0}</span>
              <span className="trading-card-stat-label">Wins</span>
            </div>

            <div className="trading-card-stat">
              <span className="trading-card-stat-value">{stats.majorWins ?? 0}</span>
              <span className="trading-card-stat-label">Majors</span>
            </div>

            <div className="trading-card-stat">
              <span className="trading-card-stat-value">{formatCurrency(stats.winnings ?? 0)}</span>
              <span className="trading-card-stat-label">Winnings</span>
            </div>

          </div>

          <p className="trading-card-footer">Season 2026</p>

        </div>

        <button
          type="button"
          className="button trading-card-download-button"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? "Preparing..." : "⬇ Download Card"}
        </button>

      </div>

    </div>,

    document.body

  )

}

export default TradingCardModal
