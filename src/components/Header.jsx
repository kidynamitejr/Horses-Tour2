import { Link, NavLink, useLocation } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { LOGO, PRIMARY_NAV, MORE_NAV } from "../siteConfig"
import { ChevronDownIcon, MenuIcon, CloseIcon, SunIcon, MoonIcon } from "./Icons"

function Header() {
  const location = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const moreRef = useRef(null)

  // Each menu remembers which page it was opened on, so it's automatically
  // closed again as soon as the visitor navigates somewhere else.
  const [moreOpenOn, setMoreOpenOn] = useState(null)
  const [mobileOpenOn, setMobileOpenOn] = useState(null)
  const moreOpen = moreOpenOn === location.pathname
  const mobileOpen = mobileOpenOn === location.pathname
  const setMoreOpen = (open) => setMoreOpenOn(open ? location.pathname : null)
  const setMobileOpen = (open) => setMobileOpenOn(open ? location.pathname : null)

  // Defaults to the OS/browser preference the first time a visitor
  // shows up, then remembers whatever they pick from here on.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("horses-tour-theme")
      if (saved) return saved
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    } catch {
      return "light"
    }
  })

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 10)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll)

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)

    try {
      localStorage.setItem("horses-tour-theme", theme)
    } catch {
      // Private browsing etc. - theme just won't persist, that's fine.
    }
  }, [theme])

  // Start each new page at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Click anywhere outside the "More" menu (or press Escape) to close it.
  useEffect(() => {
    if (!moreOpen) return

    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpenOn(null)
    }

    function handleKey(e) {
      if (e.key === "Escape") setMoreOpenOn(null)
    }

    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)

    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [moreOpen])

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileOpen)
  }, [mobileOpen])

  const moreIsActive = MORE_NAV.some((item) => location.pathname.startsWith(item.to))

  const themeButton = (
    <button
      type="button"
      className="site-icon-button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )

  return (
    <header className={`site-header${isScrolled ? " is-scrolled" : ""}${mobileOpen ? " menu-is-open" : ""}`}>
      <div className="site-header-inner">
        <Link to="/" className="site-brand" aria-label="Horses Tour home">
          <img src={LOGO} alt="" className="site-brand-logo" />
          <span className="site-brand-text">
            Horses Tour
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" end>Home</NavLink>

          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
          ))}

          <div className="site-nav-more" ref={moreRef}>
            <button
              type="button"
              className={`site-nav-more-toggle${moreIsActive ? " active" : ""}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              More <ChevronDownIcon size={16} />
            </button>

            {moreOpen && (
              <div className="site-nav-dropdown">
                {MORE_NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} className="site-nav-dropdown-item">
                    <span className="site-nav-dropdown-label">{item.label}</span>
                    <span className="site-nav-dropdown-note">{item.note}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="site-header-actions">
          {themeButton}

          <Link to="/schedule" className="btn btn-primary site-header-cta">
            Next Event
          </Link>

          <button
            type="button"
            className="site-icon-button site-menu-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="site-mobile-nav" aria-label="Mobile">
          <NavLink to="/" end>Home</NavLink>

          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
          ))}

          <span className="site-mobile-nav-heading">More from the tour</span>

          {MORE_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
          ))}

          <Link to="/schedule" className="btn btn-primary site-mobile-nav-cta">
            Next Event
          </Link>
        </nav>
      )}
    </header>
  )
}

export default Header
