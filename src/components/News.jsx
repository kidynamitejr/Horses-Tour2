import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getNews } from "../data/googleSheets"

function News() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNews() {
      try {
        const data = await getNews()

        const sorted = data.sort(
          (a, b) => Number(b["Article ID"]) - Number(a["Article ID"])
        )

        setArticles(sorted)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadNews()
  }, [])

  if (loading) {
    return (
      <section className="card">
        <h2>Latest News</h2>
        <p>Loading...</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Latest News</h2>

      <div className="news-grid">
        {articles.map((article) => (
          <Link
            className="news-card"
            key={article["Article ID"]}
            to={`/news/${article["Article ID"]}`}
          >
            <div className="news-card-image-wrap">

              <img
                src={article.Image}
                alt={article.Headline}
              />

              <span className="news-card-date">{article.Date}</span>

            </div>

            <div className="news-card-body">

              <h3>{article.Headline}</h3>

              <p>
                {article.Article.length > 220
                  ? article.Article.substring(0, 220) + "..."
                  : article.Article}
              </p>

              <span className="news-card-read-more">Read More →</span>

            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default News
