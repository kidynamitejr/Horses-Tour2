import AdminSwitch from "./AdminSwitch"
import BannerAdmin from "./BannerAdmin"
import NotificationsAdmin from "./NotificationsAdmin"
import { BellIcon, BrowserIcon } from "../Icons"

// Admin > Banner & Notifications.
const OPTIONS = [
  {
    id: "banner",
    title: "Website banner",
    note: "A message across the top of every page",
    icon: <BrowserIcon size={20} />,
    color: "#1a9fe0",
    render: () => <BannerAdmin />,
  },
  {
    id: "notifications",
    title: "Phone notification",
    note: "Sent to every phone with alerts on",
    icon: <BellIcon size={20} />,
    color: "#c9a227",
    render: () => <NotificationsAdmin />,
  },
]

function AnnouncementsAdmin() {
  return <AdminSwitch options={OPTIONS} storageKey="ht-admin-announce" label="What are you sending?" />
}

export default AnnouncementsAdmin
