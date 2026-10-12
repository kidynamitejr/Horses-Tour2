import { Link } from "react-router-dom"
import { LOGO, PRIMARY_NAV, MORE_NAV } from "../siteConfig"

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-grid">
        <div className="site-footer-brand">
          <Link to="/" className="site-brand site-brand-footer">
            <img src={LOGO} alt="" className="site-brand-logo" />
            <span className="site-brand-text">Horses Tour</span>
          </Link>

          <p>
            Competitive scramble golf across Louisiana's best courses.
            Live standings, player stats, and every champion in tour history.
          </p>

          <Link to="/schedule" className="btn btn-light">
            View the Schedule
          </Link>
        </div>

        <div>
          <h4>The Tour</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}><Link to={item.to}>{item.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Explore</h4>
          <ul>
            {MORE_NAV.slice(0, 4).map((item) => (
              <li key={item.to}><Link to={item.to}>{item.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Tools</h4>
          <ul>
            {MORE_NAV.slice(4).map((item) => (
              <li key={item.to}><Link to={item.to}>{item.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container site-footer-bottom">
        <span>© {new Date().getFullYear()} Horses Tour. All rights reserved.</span>
        <span>Course photography from our host clubs · Stock photography via Unsplash</span>
      </div>
    </footer>
  )
}

export default Footer
