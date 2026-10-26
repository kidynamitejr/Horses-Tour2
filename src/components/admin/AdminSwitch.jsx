import { useState } from "react"

// Two (or more) related admin editors under one tab, with a big switch at
// the top so it's obvious which one you're working on. Each option:
// { id, title, note, icon, color, render }. The choice is remembered for
// the visit under storageKey.
function AdminSwitch({ options, storageKey, label }) {
  const [current, setCurrent] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return options.some((o) => o.id === saved) ? saved : options[0].id
    } catch {
      return options[0].id
    }
  })
  const active = options.find((o) => o.id === current) || options[0]

  function pick(id) {
    setCurrent(id)
    try {
      sessionStorage.setItem(storageKey, id)
    } catch {
      // Not remembered - fine.
    }
  }

  return (
    <div className="ana">
      <div className="ana-switch" role="tablist" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === active.id}
            className={`ana-option${o.id === active.id ? " is-active" : ""}`}
            style={{ "--ana-color": o.color }}
            onClick={() => pick(o.id)}
          >
            <span className="ana-option-icon">{o.icon}</span>
            <span>
              <b>{o.title}</b>
              <small>{o.note}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="ana-panel" style={{ "--ana-color": active.color }}>
        {active.render()}
      </div>
    </div>
  )
}

export default AdminSwitch
