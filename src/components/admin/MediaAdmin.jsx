import AdminSwitch from "./AdminSwitch"
import NewsAdmin from "../NewsAdmin"
import GalleryAdmin from "../GalleryAdmin"
import { NewspaperIcon, PhotoIcon } from "../Icons"

// Admin > News & Gallery.
const OPTIONS = [
  {
    id: "news",
    title: "News",
    note: "Write and edit articles",
    icon: <NewspaperIcon size={20} />,
    color: "#2d6a4f",
    render: () => <NewsAdmin />,
  },
  {
    id: "gallery",
    title: "Gallery",
    note: "Manage photos people have uploaded",
    icon: <PhotoIcon size={20} />,
    color: "#7b5cc4",
    render: () => <GalleryAdmin />,
  },
]

function MediaAdmin() {
  return <AdminSwitch options={OPTIONS} storageKey="ht-admin-media" label="News or gallery" />
}

export default MediaAdmin
