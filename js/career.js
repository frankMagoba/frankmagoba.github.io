// "Where I've worked": a cable with a port for each role, oldest on the left. Drag the plug along it,
// click a port, or use the arrow keys; the card under the cable shows the role it's plugged into.
// "Show the whole list" opens every role at once, for reading straight through.
import { sound } from "./sound.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
// "May 2019" -> 2019.33, "2022" -> 2022, for ordering
const when = (s) => { const [m, y] = s.includes(" ") ? s.split(" ") : [null, s]; return +y + (m ? MONTHS.indexOf(m) / 12 : 0); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const span = (start, end) => `${start} to ${end === "Present" ? "now" : end}`;

// Roles at the same company become one stop, so a promotion reads as one run rather than two jobs:
// the stop starts with the first role and carries every role, newest first.
function stops(experience, education) {
  const byCompany = new Map();
  for (const e of experience) {
    const key = e.company.replace(/\s*\(.*\)$/, "");
    byCompany.set(key, [...(byCompany.get(key) || []), e]);
  }
  const jobs = [...byCompany.values()].map((roles) => {
    roles = [...roles].sort((a, b) => when(b.start) - when(a.start));
    const latest = roles[0], first = roles.at(-1), now = latest.end === "Present", grouped = roles.length > 1;
    return {
      // a single role is titled by the role; a run of roles by the company, with the roles in a ladder below
      t: when(first.start), year: first.start.match(/\d{4}/)[0],
      title: grouped ? latest.company : latest.role, org: grouped ? latest.type : `${latest.company} · ${latest.type}`,
      points: latest.points, now, status: now ? "Current" : `${first.start} to ${latest.end}`, dates: span(first.start, latest.end),
      roles: grouped ? roles.map((r) => ({ title: r.role, dates: span(r.start, r.end), points: r.points })) : null,
    };
  });
  const study = education.map((e) => {
    const [degree, ...rest] = e.degree.split(", ");
    return { t: +e.end - 0.01, year: e.end, title: degree, org: e.school, points: rest.length ? [`${rest.join(", ")}.`] : [], status: "Completed", now: false, dates: `${e.start} to ${e.end}` };
  });
  return [...study, ...jobs].sort((a, b) => a.t - b.t);
}

const bullets = (points, max) => (points.length ? `<ul>${points.slice(0, max).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "")
  + (points.length > max ? `<p class="more">+${points.length - max} more in the full list</p>` : "");

// A promotion ladder, newest role on top: each rung has its title and dates, with "promoted" between.
const ladder = (roles) => `<ol class="ladder">${roles.map((r, i) =>
  `<li${i === 0 ? ' class="latest"' : ""}><b>${esc(r.title)}</b><span>${esc(r.dates)}</span>${i < roles.length - 1 ? '<em>↑ promoted</em>' : ""}</li>`).join("")}</ol>`;

// The card shows the latest role's first points; the full list (max = Infinity) shows each role's own.
const card = (s, max, year = true) => `${year ? `<div class="cy">${s.year}</div>` : ""}
  <div><h3>${esc(s.title)}</h3><div class="o">${esc(s.org)}</div>
  ${s.roles ? ladder(s.roles) : ""}
  ${s.roles && max === Infinity
    ? s.roles.map((r) => `<p class="role-h">${esc(r.title)} · ${esc(r.dates)}</p>${bullets(r.points, max)}`).join("")
    : bullets(s.points, max)}</div>
  <span class="st${s.now ? " now" : ""}">${esc(s.status)}</span>`;

export function mountCareer(root, experience, education) {
  const list = stops(experience, education), n = list.length;
  const at = (i) => 5 + (i * 90) / (n - 1); // ports sit between 5% and 95% of the cable
  root.innerHTML = `
    <div class="track" role="slider" tabindex="0" aria-label="Career timeline. Drag the plug, or use the arrow keys." aria-valuemin="0" aria-valuemax="${n - 1}">
      <div class="wire"><i></i></div>
      <div class="ports">${list.map((s, i) => `<button class="port" type="button" tabindex="-1" data-i="${i}" style="left:${at(i)}%"><i></i><span>${s.year}</span></button>`).join("")}</div>
      <div class="plug" aria-hidden="true"></div>
    </div>
    <div class="career-card" aria-live="polite"></div>
    <button class="pill-btn career-all" type="button" aria-expanded="false">Show the whole list ›</button>
    <div class="path" hidden>${[...list].reverse().map((s) => `<div><span class="y">${esc(s.dates)}</span>${card(s, Infinity, false)}</div>`).join("")}</div>`;

  const track = root.querySelector(".track"), wire = root.querySelector(".wire i"), plug = root.querySelector(".plug");
  const box = root.querySelector(".career-card"), ports = [...root.querySelectorAll(".port")];
  let cur = -1, dragging = false;

  function show(i) {
    if (i === cur) return;
    const first = cur === -1;
    cur = i;
    box.innerHTML = card(list[i], 2);
    box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
    ports.forEach((p, k) => { p.classList.toggle("on", k <= i); p.classList.toggle("cur", k === i); });
    track.setAttribute("aria-valuenow", String(i));
    track.setAttribute("aria-valuetext", `${list[i].year}: ${list[i].title}, ${list[i].org}`);
    if (!first) sound.play("plug");
  }
  const plugTo = (pct) => { plug.style.left = `${pct}%`; wire.style.width = `${pct}%`; };
  const snap = (i) => { i = clamp(i, 0, n - 1); plugTo(at(i)); show(i); };
  const pctAt = (e) => { const r = track.getBoundingClientRect(); return clamp(((e.clientX - r.left) / r.width) * 100, at(0), at(n - 1)); };
  const nearest = (pct) => Math.round(((pct - at(0)) * (n - 1)) / 90);

  track.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".port")) return;
    dragging = true; track.classList.add("dragging");
    try { track.setPointerCapture(e.pointerId); } catch {}
    const pct = pctAt(e); plugTo(pct); show(nearest(pct));
  });
  track.addEventListener("pointermove", (e) => { if (!dragging) return; const pct = pctAt(e); plugTo(pct); show(nearest(pct)); });
  const end = () => { if (!dragging) return; dragging = false; track.classList.remove("dragging"); snap(cur); };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);
  ports.forEach((p) => p.addEventListener("click", () => snap(+p.dataset.i)));
  track.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (step) { e.preventDefault(); snap(cur + step); }
    else if (e.key === "Home") { e.preventDefault(); snap(0); }
    else if (e.key === "End") { e.preventDefault(); snap(n - 1); }
  });
  snap(n - 1); // start plugged into the current role

  const all = root.querySelector(".career-all"), path = root.querySelector(".path");
  all.addEventListener("click", () => {
    const open = path.hidden;
    path.hidden = !open;
    all.setAttribute("aria-expanded", String(open));
    all.textContent = open ? "Hide the list ‹" : "Show the whole list ›";
  });
}
