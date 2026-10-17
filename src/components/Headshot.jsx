const BASE = import.meta.env.BASE_URL

// Player headshot by Player ID, falling back to the default silhouette.
function Headshot({ id }) {
  return (
    <img
      src={`${BASE}images/players/${id || "default"}.jpg`}
      alt=""
      onError={(e) => {
        e.target.src = `${BASE}images/players/default.jpg`
      }}
    />
  )
}

export default Headshot
