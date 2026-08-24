#!/usr/bin/env python3
"""Refresh the fan suite's data. Stdlib only, no dependencies, no API keys.

Run by GitHub Actions every morning (see .github/workflows/daily.yml).
Reads club.json to know which club it's serving — point it at any AFL club.

Sources (all public, all free):
  Squiggle API (api.squiggle.com.au)  fixtures, results, ladder
  Google News RSS                     club news headlines

Outputs:
  data/footy.json   next game, last five results, full ladder, club row
  data/feed.json    news items
"""

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

CLUB = json.loads((ROOT / "club.json").read_text(encoding="utf-8"))

# Squiggle asks bots to identify themselves — be a good citizen.
UA = {"User-Agent": "afl-fan-suite (github.com/ChinmayGit8765/collingwood-fan-suite)"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def get_text(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", "replace")


def iso(squiggle_date, tz):
    """Squiggle gives '2026-08-29 19:25:00' + '+10:00' — join into real ISO."""
    return squiggle_date.replace(" ", "T") + (tz or "+10:00")


def footy():
    year = datetime.now(timezone.utc).year
    api = "https://api.squiggle.com.au/?q="

    teams = get_json(api + "teams")["teams"]
    team = next(t for t in teams if t["name"] == CLUB["squiggleTeam"])

    games = get_json(f"{api}games;year={year};team={team['id']}").get("games", [])
    if not games:  # off-season — show last season instead
        year -= 1
        games = get_json(f"{api}games;year={year};team={team['id']}").get("games", [])
    games.sort(key=lambda g: g["date"])

    def slim(g):
        return {
            "round": g.get("roundname") or f"Round {g.get('round')}",
            "date": iso(g["date"], g.get("tz")),
            "venue": g.get("venue"),
            "home": g.get("hteam"),
            "away": g.get("ateam"),
            "homeScore": g.get("hscore"),
            "awayScore": g.get("ascore"),
            "complete": g.get("complete", 0),
            "final": bool(g.get("is_final")),
        }

    played = [g for g in games if g.get("complete") == 100]
    upcoming = [g for g in games if g.get("complete", 0) < 100]

    ladder_rows = get_json(f"{api}standings;year={year}").get("standings", [])
    ladder = [
        {
            "rank": r["rank"], "name": r["name"], "played": r["played"],
            "wins": r["wins"], "losses": r["losses"], "draws": r["draws"],
            "percentage": round(r["percentage"], 1), "pts": r["pts"],
        }
        for r in sorted(ladder_rows, key=lambda r: r["rank"])
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "season": year,
        "club": CLUB["squiggleTeam"],
        "nextGame": slim(upcoming[0]) if upcoming else None,
        "lastGames": [slim(g) for g in played[-5:]],
        "ladder": ladder,
        "clubRow": next((r for r in ladder if r["name"] == CLUB["squiggleTeam"]), None),
    }


def news():
    from urllib.parse import quote

    url = (
        "https://news.google.com/rss/search?q="
        + quote(CLUB["newsQuery"])
        + "&hl=en-AU&gl=AU&ceid=AU:en"
    )
    root = ET.fromstring(get_text(url))
    items, seen = [], set()
    for item in root.iter("item"):
        title = unescape((item.findtext("title") or "").strip())
        # Google News appends " - Source" to titles — split it off.
        m = re.match(r"^(.*)\s+-\s+([^-]+)$", title)
        headline, source = (m.group(1), m.group(2)) if m else (title, "")
        src_el = item.find("source")
        if src_el is not None and (src_el.text or "").strip():
            source = src_el.text.strip()
        key = headline.lower()[:70]
        if not headline or key in seen:
            continue
        seen.add(key)
        published = ""
        try:
            from email.utils import parsedate_to_datetime

            published = parsedate_to_datetime(item.findtext("pubDate")).isoformat()
        except Exception:
            pass
        items.append(
            {
                "title": headline,
                "url": item.findtext("link") or "",
                "source": source,
                "published": published,
            }
        )
        if len(items) >= 14:
            break
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "items": items,
    }


def main():
    DATA.mkdir(exist_ok=True)
    for name, fn in (("footy.json", footy), ("feed.json", news)):
        try:
            payload = fn()
            (DATA / name).write_text(
                json.dumps(payload, indent=1, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"wrote data/{name}")
        except Exception as e:  # one source failing shouldn't blank the other
            print(f"SKIPPED data/{name}: {e}")


if __name__ == "__main__":
    main()
