// Full-width photo banner at the top of every page except Home, which has
// its own larger hero.
function Hero({ eyebrow, title, subtitle, image }) {
  return (
    <section className="page-hero">
      <img className="page-hero-image" src={image} alt="" />

      <div className="page-hero-overlay" />

      <div className="container page-hero-content">
        {eyebrow && <span className="eyebrow eyebrow-light">{eyebrow}</span>}

        <h1>{title}</h1>

        {subtitle && <p>{subtitle}</p>}
      </div>
    </section>
  )
}

export default Hero
