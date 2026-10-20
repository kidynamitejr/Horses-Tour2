import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getNews } from "../data/googleSheets"

// The article split into paragraphs, with the optional second photo
// placed partway through like an online news story.
function ArticleBody({ article }) {
  const paragraphs = (article.Article || "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const image2 = (article["Image 2"] || "").trim()
  const caption2 = (article["Image 2 Caption"] || "").trim()
  const insertAt = Math.ceil(paragraphs.length / 2)

  const figure = image2 && (
    <figure className="article-figure" key="figure">
      <img src={image2} alt={caption2 || article.Headline} loading="lazy" />
      {caption2 && <figcaption>{caption2}</figcaption>}
    </figure>
  )

  return (
    <div className="article-body-text">
      {paragraphs.map((p, i) => (
        <span key={i} className="article-paragraph-group">
          <p>{p}</p>
          {i === insertAt - 1 && figure}
        </span>
      ))}
      {paragraphs.length === 0 && figure}
    </div>
  )
}

function Article() {
  const { id } = useParams()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadArticle() {
      const data = await getNews()

      const found = data.find(
        (a) => String(a["Article ID"]) === String(id)
      )

      setArticle(found)
      setLoading(false)
    }

    loadArticle()
  }, [id])

  if (loading) {
    return (
      <section className="card">
        <h2>Loading...</h2>
      </section>
    )
  }

  if (!article) {
    return (
      <section className="card">
        <h2>Article not found.</h2>

        <Link to="/news">
          ← Back to News
        </Link>
      </section>
    )
  }

  return (
    <>
      <section className="next-event-feature article-hero">

        <img
          src={article.Image}
          alt={article.Headline}
          className="next-event-bg-img"
        />

        <div className="next-event-overlay" />

        <Link to="/news" className="article-back-link">
          ← Back to News
        </Link>

        <div className="next-event-content">

          <p className="next-event-eyebrow">{article.Date}</p>

          <h1 className="next-event-title article-title">{article.Headline}</h1>

        </div>

      </section>

      <section className="card article-body-card">

        <ArticleBody article={article} />

      </section>
    </>
  )
}

export default Article
