import { headshotUrl, playerImageFallback } from "../utils/headshot"

// Player headshot by Player ID, falling back to the default silhouette.
function Headshot({ id }) {
  return <img src={headshotUrl(id)} alt="" onError={playerImageFallback} />
}

export default Headshot
