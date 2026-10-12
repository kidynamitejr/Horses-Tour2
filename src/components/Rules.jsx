import { useEffect, useState } from "react"
import { getRules } from "../data/googleSheets"

function Rules() {

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadRules() {

      try {

        const data = await getRules()

        const sorted = data.sort(
          (a, b) => Number(a["Rule #"]) - Number(b["Rule #"])
        )

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
  // block of rows), it gets its own section in its own place rather
  // than being pulled up into the earlier section, which is what was
  // causing the Rule # to jump out of order.
  const sections = []

  rules.forEach((rule) => {

    const last = sections[sections.length - 1]

    if (last && last.category === rule.Category) {
      last.rules.push(rule)
    } else {
      sections.push({ category: rule.Category, rules: [rule] })
    }

  })

  return (

    <section className="card">

      <h2>
        Rules
      </h2>


      <h3>
        Tour Rules
      </h3>

      {loading && (
        <p>Loading rules...</p>
      )}

      {!loading && sections.map((section, index) => (

        <div key={`${section.category}-${index}`} className="rules-category">

          <h4>
            {section.category}
          </h4>

          <ul className="rules-list">

            {section.rules.map((rule) => (
              <li key={rule["Rule #"]} className="rules-list-item">
                <span className="rule-number">
                  {rule["Rule #"]}.
                </span>

                <span>
                  {rule.Rule}
                </span>
              </li>
            ))}

          </ul>

        </div>

      ))}


    </section>

  )

}


export default Rules