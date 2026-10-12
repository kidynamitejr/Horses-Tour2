import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import Dashboard from "../components/Dashboard"
import NextEventFeature from "../components/NextEventFeature"
import LastMatchFeature from "../components/LastMatchFeature"
import News from "../components/News"
import HottestPlayer from "../components/HottestPlayer"
import { getEvents } from "../data/googleSheets"
import { PHOTOS, COURSES } from "../siteConfig"
import {
  CalendarIcon,
  FlagIcon,
  MapPinIcon,
  TrophyIcon,
  UsersIcon,
  ArrowRightIcon,
} from "../components/Icons"

function SectionHeading({ eyebrow, title, children, link }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>

      {link && (
        <Link to={link.to} className="text-link">
          {link.label} <ArrowRightIcon size={16} />
        </Link>
      )}
    </div>
  )
}

function HomeHero() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    getEvents().then(setEvents)
  }, [])

  const scheduled = events.filter((e) => e["Event Name"])
  const played = scheduled.filter((e) => (e.Status || "").trim().toLowerCase() === "played")
  const courses = new Set(scheduled.map((e) => (e.Course || "").trim()).filter(Boolean))
  const majors = scheduled.filter((e) =>
    ["major", "championship"].includes((e["Event Type"] || "").trim().toLowerCase())
  )

  const loaded = scheduled.length > 0
  const show = (value) => (loaded ? value : "–")

  const stats = [
    { icon: CalendarIcon, value: show(scheduled.length), label: "Season Events" },
    { icon: FlagIcon, value: show(played.length), label: "Events Played" },
    { icon: MapPinIcon, value: show(courses.size), label: "Host Courses" },
    { icon: TrophyIcon, value: show(majors.length), label: "Majors" },
    { icon: UsersIcon, value: "2-Player", label: "Scramble Format" },
  ]

  return (
    <section className="home-hero">
      <img className="home-hero-image" src={PHOTOS.aerialFairway} alt="" />

      <div className="home-hero-overlay" />

      <div className="container home-hero-content">
        <span className="eyebrow eyebrow-light">Horses Tour · 2026 Season</span>

        <h1>Where Every Shot Counts</h1>

        <p>
          The Horses Tour is competitive scramble golf, played across Louisiana's
          best courses. Live standings, hole-by-hole scoring, player stats and
          every champion in tour history, all in one place.
        </p>

        <div className="home-hero-actions">
          <Link to="/leaderboard" className="btn btn-primary btn-lg">
            View Leaderboard
          </Link>

          <Link to="/schedule" className="btn btn-ghost-light btn-lg">
            Full Schedule
          </Link>
        </div>

        <ul className="home-hero-stats">
          {stats.map(({ icon: StatIcon, value, label }) => (
            <li key={label}>
              <span className="home-hero-stat-icon"><StatIcon size={22} /></span>
              <strong>{value}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CourseStrip() {
  // Listed twice so the scrolling strip loops seamlessly.
  const loop = [...COURSES, ...COURSES]

  return (
    <section className="band band-muted course-strip">
      <div className="container">
        <h2 className="course-strip-title">Our Host Courses</h2>
      </div>

      <div className="course-strip-track" aria-label="Host courses">
        <div className="course-strip-rail">
          {loop.map((course, index) => (
            <figure className="course-strip-card" key={`${course.name}-${index}`} aria-hidden={index >= COURSES.length}>
              <img src={course.image} alt={index < COURSES.length ? course.name : ""} loading="lazy" />
              <figcaption>{course.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureSplit({ image, eyebrow, title, children, to, cta, reverse }) {
  return (
    <div className={`feature-split${reverse ? " feature-split-reverse" : ""}`}>
      <div className="feature-split-media">
        <img src={image} alt="" loading="lazy" />
      </div>

      <div className="feature-split-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{children}</p>
        <Link to={to} className="btn btn-primary">
          {cta}
        </Link>
      </div>
    </div>
  )
}

function Home() {
  return (
    <>
      <HomeHero />

      <CourseStrip />

      <section className="band">
        <div className="container">
          <SectionHeading
            eyebrow="Up Next"
            title="The Next Tee Time"
            link={{ to: "/schedule", label: "Full schedule" }}
          />

          <NextEventFeature />
        </div>
      </section>

      <section className="band band-muted">
        <div className="container">
          <SectionHeading eyebrow="Season at a Glance" title="2026 by the Numbers" />

          <Dashboard />
        </div>
      </section>

      <section className="band">
        <div className="container feature-splits">
          <FeatureSplit
            image={PHOTOS.driverSwing}
            eyebrow="Standings"
            title="The Race for the Championship"
            to="/leaderboard"
            cta="View Leaderboard"
          >
            Every event moves the standings. Follow ranking points, power
            points and the championship race as it unfolds, updated straight
            from the scorecard after every round.
          </FeatureSplit>

          <FeatureSplit
            image={PHOTOS.golfersToast}
            eyebrow="The Field"
            title="Meet the Players"
            to="/players"
            cta="Meet the Players"
            reverse
          >
            Full profiles for every competitor: career winnings, badges,
            round-by-round history, collectible trading cards and head-to-head
            comparisons with anyone on tour.
          </FeatureSplit>

          <FeatureSplit
            image={PHOTOS.aerialGreen}
            eyebrow="Course Intelligence"
            title="Every Hole, Every Round"
            to="/course-history"
            cta="Explore Course History"
          >
            Hole-by-hole scoring charts for every match, course records, and
            the stats that settle the debates: most birdies, longest top-3
            streaks and the best team rounds on tour.
          </FeatureSplit>
        </div>
      </section>

      <section className="band band-muted">
        <div className="container">
          <SectionHeading
            eyebrow="Results"
            title="Last Time Out"
            link={{ to: "/past-matches", label: "All past matches" }}
          />

          <LastMatchFeature />
        </div>
      </section>

      <section className="photo-band">
        <img className="photo-band-image" src={PHOTOS.sunsetSwing} alt="" loading="lazy" />
        <div className="photo-band-overlay" />

        <div className="container photo-band-content">
          <span className="eyebrow eyebrow-light">Hall of Champions</span>
          <h2>Every champion, remembered.</h2>
          <p>
            From the first tee shot of the season to the Island Championship,
            every winning team earns its place in tour history.
          </p>
          <Link to="/hall-of-champions" className="btn btn-light btn-lg">
            Visit the Hall of Champions
          </Link>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <SectionHeading
            eyebrow="Tour Media"
            title="Latest from the Tour"
            link={{ to: "/news", label: "All news" }}
          />

          <div className="home-news-grid">
            <News />
            <HottestPlayer />
          </div>
        </div>
      </section>
    </>
  )
}

export default Home
