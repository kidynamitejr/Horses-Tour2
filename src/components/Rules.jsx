import { useEffect, useState } from "react"
import { getRules } from "../data/googleSheets"
import { slugify } from "../utils/slugify"

// Wraps every match of `query` in <mark> so search hits stand out.
function Highlight({ text, query }) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
  )
}

function Rules() {

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {

    async function loadRules() {

      try {

        const data = await getRules()

        const sorted = data
          .filter((r) => r.Rule && r.Rule.trim())
          .map((r) => ({ ...r, Rule: r.Rule.replace(/\s+/g, " ").trim(), Category: (r.Category || "General").trim() }))
          .sort((a, b) => Number(a["Rule #"]) - Number(b["Rule #"]))

        setRules(sorted)

      } catch (error) {

        console.error("Rules Error:", error)

      } finally {

        setLoading(false)

      }

    }

    loadRules()

  }, [])

  // Groups rules into consecutive runs by Category instead of merging
  // every rule sharing a category name into one bucket - if the same
  // category name shows up again further down the sheet (a separate
  // block of rows), it gets its own section in its own place (marked
  // "continued") so the Rule # never jumps out of order.
  const sections = []
  const seen = {}

  rules.forEach((rule) => {

    const last = sections[sections.length - 1]

    if (last && last.category === rule.Category) {
      last.rules.push(rule)
    } else {
      seen[rule.Category] = (seen[rule.Category] || 0) + 1
      sections.push({
        category: rule.Category,
        continued: seen[rule.Category] > 1,
        id: `rules-${slugify(rule.Category)}-${seen[rule.Category]}`,
        rules: [rule],
      })
    }

  })

  const q = query.trim().toLowerCase()

  const shownSections = sections
    .map((section) => ({
      ...section,
      rules: q
        ? section.rules.filter((r) => r.Rule.toLowerCase().includes(q) || section.category.toLowerCase().includes(q))
        : section.rules,
    }))
    .filter((section) => section.rules.length > 0)

  const matchCount = shownSections.reduce((n, s) => n + s.rules.length, 0)

  function jumpTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (

    <div className="rb">

      <section className="rb-intro">
        <div>
          <span className="rb-eyebrow">Official Rules of Play</span>
          <h2>Horses Tour Rulebook</h2>
          <p>
            Every event is a two-person scramble. These rules apply to every round on
            tour unless the Tournament Committee announces otherwise.
          </p>
        </div>

        <dl className="rb-facts">
          <div><dt>Rules</dt><dd>{loading ? "–" : rules.length}</dd></div>
          <div><dt>Sections</dt><dd>{loading ? "–" : new Set(sections.map((s) => s.category)).size}</dd></div>
          <div><dt>Format</dt><dd>2-Person Scramble</dd></div>
        </dl>
      </section>

      <div className="rb-layout">

        <aside className="rb-toc" aria-label="Rule sections">
          <span className="rb-toc-title">Sections</span>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}>
                <button type="button" onClick={() => jumpTo(section.id)}>
                  <span className="rb-toc-num">{index + 1}</span>
                  <span className="rb-toc-label">
                    {section.category}{section.continued && " (cont.)"}
                  </span>
                  <span className="rb-toc-count">{section.rules.length}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="rb-main">

          <div className="rb-search">
            <input
              type="search"
              placeholder="Search the rules (e.g. gimme, relief, contribution)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the rules"
            />
            {q && <span>{matchCount} rule{matchCount === 1 ? "" : "s"} found</span>}
          </div>

          {loading && <p className="rb-empty">Loading rules...</p>}

          {!loading && shownSections.length === 0 && (
            <p className="rb-empty">No rules match “{query}”.</p>
          )}

          {shownSections.map((section) => {

            const number = sections.findIndex((s) => s.id === section.id) + 1

            return (

              <section className="rb-section" id={section.id} key={section.id}>

                <header className="rb-section-head">
                  <span className="rb-section-num">{String(number).padStart(2, "0")}</span>
                  <div>
                    <h3>
                      <Highlight text={section.category} query={q} />
                      {section.continued && <small> (continued)</small>}
                    </h3>
                    <span>
                      Rules {section.rules[0]["Rule #"]}
                      {section.rules.length > 1 && `–${section.rules[section.rules.length - 1]["Rule #"]}`}
                    </span>
                  </div>
                </header>

                <ol className="rb-rules">
                  {section.rules.map((rule) => (
                    <li key={rule["Rule #"]}>
                      <span className="rb-rule-num">{rule["Rule #"]}</span>
                      <p><Highlight text={rule.Rule} query={q} /></p>
                    </li>
                  ))}
                </ol>

              </section>

            )

          })}

          <p className="rb-footnote">
            The Tournament Committee&apos;s interpretation of these rules is final. Questions during a
            round? Play a second ball if appropriate and check with the committee after the hole.
          </p>

        </div>

      </div>

    </div>

  )

}

export default Rules
