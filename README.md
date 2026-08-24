# Side by Side ⚫⚪

A self-updating home page for Collingwood tragics — and, with a one-file edit,
for fans of **any AFL club**.

**Live:** https://chinmaygit8765.github.io/collingwood-fan-suite/

Every morning a GitHub Actions cron sweeps the public sources and rebuilds the
page:

- **Next-game countdown** — opponent, venue, round, ticking clock.
- **Form guide** — last five results with scores.
- **Live ladder** — all 18 clubs, finals line marked, your club highlighted.
- **The Daily Squawk** — every fresh headline about the club, deduplicated.

Pure static site. No framework, no build step, no backend, no API keys, no
tracking. Data comes from the wonderful free [Squiggle API](https://api.squiggle.com.au)
(fixtures, results, ladder) and Google News RSS (headlines).

```
index.html               the page
club.json                ← which club this suite serves (see "Reskin it")
assets/style.css         black & white editorial design
assets/app.js            renders everything from JSON
data/footy.json          generated daily — fixtures, results, ladder
data/feed.json           generated daily — news headlines
scripts/update.py        the sweeper (stdlib-only Python)
.github/workflows/       daily cron + GitHub Pages deploy
```

## Run locally

```sh
npm run dev          # npx serve, open http://localhost:3000
npm run refresh      # = python scripts/update.py — pull fresh data now
```

(`fetch()` needs http, so open it through a server, not from disk.)

## Reskin it for your club

Everything club-specific lives in **`club.json`**:

```json
{
  "club": "Collingwood",
  "nickname": "Magpies",
  "squiggleTeam": "Collingwood",
  "newsQuery": "\"Collingwood Magpies\" AFL",
  "tagline": "Good old Collingwood forever",
  "chant": "SIDE BY SIDE",
  "emojiBadge": "⚫⚪"
}
```

1. Fork this repo.
2. Edit `club.json` — `squiggleTeam` must match the club's name in the
   [Squiggle teams list](https://api.squiggle.com.au/?q=teams); `newsQuery` is a
   Google News search; the rest is flavour.
3. Optionally tweak the CSS variables at the top of `assets/style.css` if your
   club's colours deserve better than black and white (they don't).
4. Push to `main`, then repo **Settings → Pages → Source: GitHub Actions**.

Done — the cron does the rest, forever.

## How the cron works

`.github/workflows/daily.yml` fires at 20:45 UTC (early morning AEST), runs
`scripts/update.py`, commits whatever changed in `data/`, and deploys to Pages
in the same job so the data and the site can never drift apart. `[skip ci]` in
the bot's commit message keeps the push from re-triggering the workflow, and
`permissions: contents: write` is what lets the bot push at all. The daily
commit also counts as repo activity, so GitHub's 60-day scheduled-workflow
timeout never hits.

The sweeper is deliberately boring: stdlib-only Python, one `try/except` per
data file so a flaky source can't blank the other, and a polite `User-Agent`
so Squiggle knows who's calling.

---

Fan-made. Not affiliated with the AFL, Collingwood, or any club — just the
product of one supporter and a cron job.
Built by [Exaryn ✳](https://chinmaygit8765.github.io/exaryn-studio/).
Floreat Pica.
