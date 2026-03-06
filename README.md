# 2025 March Madness Player Pool Tracker

Live tracker for an 11-person snake draft March Madness pool. Pulls real-time player point totals from the ESPN API and aggregates them by owner.

## Features

- **Standings** — Ranked leaderboard of all 11 owners by total points
- **Team Rosters** — Each owner's drafted players with points, games played, and active/eliminated status
- **Game Log** — Per-game breakdown of every player's scoring, filterable by owner
- Auto-refreshes every 60 seconds during live tournament windows
- Mobile-first responsive design

## Local Development

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to Update Draft Data

Edit `lib/draftData.js`. Each owner has a `players` array with:

```js
{ name: "Player Name", pick: 1, team: "NCAA Team" }
```

Player names must match ESPN's `athlete.displayName` as closely as possible. The app normalizes names (case, periods, Jr./Sr. suffixes) for fuzzy matching.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. Framework preset will auto-detect as Next.js — no env vars needed
4. Click Deploy

Or use the Vercel CLI:

```bash
npx vercel
```

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- ESPN unofficial NCAAB API (no key required)
- No database — all state derived at runtime from ESPN + hardcoded draft picks

## ESPN API Endpoints Used

- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100`
- Box score: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={gameId}`
