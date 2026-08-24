/* Side by Side — renders the fan suite from JSON.
   club.json says which club; data/*.json is written by the daily cron.
   No framework, no build step. */

const $ = (sel) => document.querySelector(sel);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ago(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

const fetchJSON = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

/* ---------- club identity ---------- */

let CLUB = { club: "Collingwood", nickname: "Magpies", chant: "SIDE BY SIDE", emojiBadge: "⚫⚪" };

function renderClub() {
  $("#club-badge").textContent = CLUB.emojiBadge || "🏉";
  $("#hero-kicker").textContent = `A ${CLUB.club.toUpperCase()} SUPER-FAN SUITE — ${CLUB.chant}`;
  if (CLUB.tagline) {
    const t = CLUB.tagline;
    const i = t.toLowerCase().indexOf(CLUB.club.toLowerCase());
    $("#hero-title").innerHTML =
      i >= 0
        ? `${esc(t.slice(0, i))}<em>${esc(t.slice(i, i + CLUB.club.length))}</em>${esc(t.slice(i + CLUB.club.length))}.`
        : `${esc(t)}.`;
  }
}

/* ---------- footy data ---------- */

function gameLine(g, us) {
  const opp = g.home === us ? g.away : g.home;
  const home = g.home === us;
  return { opp, where: home ? "v" : "@", label: `${us} ${home ? "v" : "@"} ${opp}` };
}

function renderFooty(f) {
  const us = f.club;

  $("#meta-season").textContent = f.season;
  if (f.clubRow) {
    const r = f.clubRow;
    const ord = (n) => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
    $("#meta-rank").textContent = ord(r.rank).toUpperCase();
    $("#meta-record").textContent = `${r.wins}W – ${r.losses}L – ${r.draws}D`;
    $("#meta-pct").textContent = `${r.percentage}%`;
  }
  $("#meta-updated").textContent = ago(f.generated_at).toUpperCase();

  /* next game + countdown */
  if (f.nextGame) {
    const g = f.nextGame;
    $("#next-game").hidden = false;
    $("#fixture-teams").textContent = `${g.home} v ${g.away}`;
    const when = new Date(g.date);
    const local = when.toLocaleString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit",
    });
    $("#fixture-meta").textContent =
      `${g.round} · ${g.venue || "TBC"} · ${local}`.toUpperCase() + (g.final ? " · FINALS FOOTY" : "");
    const tick = () => {
      const ms = when - new Date();
      if (ms <= 0) {
        $("#countdown").innerHTML = `<span><b>NOW</b>GAME ON — UP THE ${esc((CLUB.nickname || "").toUpperCase())}!</span>`;
        return;
      }
      $("#cd-d").textContent = String(Math.floor(ms / 864e5)).padStart(2, "0");
      $("#cd-h").textContent = String(Math.floor((ms % 864e5) / 36e5)).padStart(2, "0");
      $("#cd-m").textContent = String(Math.floor((ms % 36e5) / 6e4)).padStart(2, "0");
      $("#cd-s").textContent = String(Math.floor((ms % 6e4) / 1e3)).padStart(2, "0");
      setTimeout(tick, 1000);
    };
    tick();
  }

  /* form guide */
  const form = $("#form-list");
  form.innerHTML = (f.lastGames || [])
    .slice()
    .reverse()
    .map((g) => {
      const usHome = g.home === us;
      const ours = usHome ? g.homeScore : g.awayScore;
      const theirs = usHome ? g.awayScore : g.homeScore;
      const result = ours > theirs ? "win" : ours < theirs ? "loss" : "draw";
      const letter = { win: "W", loss: "L", draw: "D" }[result];
      const { label } = gameLine(g, us);
      return `<li class="form-item ${result}">
        <span class="dot">${letter}</span>
        <span class="rnd">${esc(g.round)}</span>
        <span class="match">${esc(label)} <span style="color:var(--muted)">· ${esc(g.venue || "")}</span></span>
        <span class="score">${ours} – ${theirs}</span>
      </li>`;
    })
    .join("") || `<li class="empty mono">NO GAMES YET.</li>`;

  /* ladder */
  $("#ladder-body").innerHTML = (f.ladder || [])
    .map(
      (r) => `<tr class="${r.name === us ? "us" : ""}${r.rank === 8 ? " finals-line" : ""}">
        <td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.played}</td>
        <td>${r.wins}</td><td>${r.losses}</td><td>${r.draws}</td>
        <td>${r.percentage}</td><td>${r.pts}</td>
      </tr>`
    )
    .join("");
}

/* ---------- news ---------- */

function renderFeed(feed) {
  $("#squawk-updated").textContent = `UPDATED ${ago(feed.generated_at).toUpperCase()}`;
  $("#feed-list").innerHTML = (feed.items || [])
    .map(
      (i) => `<li class="feed-item">
        <a href="${esc(i.url)}" target="_blank" rel="noopener">
          <span class="when">${ago(i.published)}</span>
          <span class="body">
            <span class="src">${esc(i.source)}</span>
            <span class="title">${esc(i.title)}</span>
          </span>
          <span class="go" aria-hidden="true">↗</span>
        </a>
      </li>`
    )
    .join("") || `<li class="empty mono">NO NEWS — QUIET WEEK AT THE CLUB.</li>`;
}

/* ---------- boot ---------- */

(async function init() {
  try {
    CLUB = { ...CLUB, ...(await fetchJSON("club.json")) };
  } catch { /* defaults stand */ }
  renderClub();

  try {
    renderFooty(await fetchJSON("data/footy.json"));
  } catch {
    $("#form-list").innerHTML =
      `<li class="empty mono">NO DATA — RUN python scripts/update.py (fetch() NEEDS http, NOT file://)</li>`;
  }
  try {
    renderFeed(await fetchJSON("data/feed.json"));
  } catch {
    $("#feed-list").innerHTML = `<li class="empty mono">NO FEED YET — THE MORNING CRON WILL FIX THAT.</li>`;
  }
})();
