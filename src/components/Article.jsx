import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getNews } from "../data/googleSheets"

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

        <p className="article-body-text">
          {article.Article}
        </p>

      </section>
    </>
  )
}

export default Article
