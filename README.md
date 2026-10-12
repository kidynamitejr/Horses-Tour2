# Horses Tour 2

Redesigned website for the Horses Tour, a competitive scramble golf tour.
React + Vite, with all tour data read live from the published Horses Tour
Google Sheet (`src/data/googleSheets.js`).

## Run it locally

```bash
npm install
npm run dev
```

Then open the link it prints (http://localhost:5173/Horses-Tour2/).

## Where things live

- `src/theme.css` - the redesign: colors, fonts, header, heroes, home sections, footer, and component styling
- `src/siteConfig.js` - stock photos, the photo banner for each page, host course list, and header menu links
- `src/pages/Home.jsx` - home page layout
- `src/components/` - every feature (leaderboard, schedule, stats, profiles, etc.)
- `public/images/` - logo, course, player, and news photos

Stock photography is from [Unsplash](https://unsplash.com/license) (free to use).

## Deploying

Every push to `main` builds and publishes the site to GitHub Pages
(`.github/workflows/deploy.yml`).
