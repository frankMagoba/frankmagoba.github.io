import { profile, experience, projects, projectTags, skills, education, certifications, certificates } from "./content.js";
import { mountCertViewer } from "./certviewer.js";
import { initTerminal, runCommand } from "./terminal.js";
import { mountAskTerminal } from "./askterm.js";
import { runBoot } from "./boot.js";
import { wireSound } from "./sound.js";
import { reveal, countUp } from "./reveal.js";
import { mountWork } from "./work.js";
import { mountToolbox } from "./toolbox.js";
import { mountCareer } from "./career.js";
import { mountBuilding } from "./building.js";
import { mountCerts } from "./certs.js";

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of kids) n.append(c);
  return n;
};
const tagList = (items) => el("ul", { class: "tags" }, ...items.map((t) => el("li", {}, t)));

$("#lead").textContent = profile.tagline;
$("#intro").textContent = profile.intro;
$("#year").textContent = new Date().getFullYear();

const firstYear = Math.min(...experience.map((e) => +e.start.match(/\d{4}/)[0]));
const stats = [
  [new Date().getFullYear() - firstYear, "years"],
  [new Set(experience.map((e) => e.company.replace(/\s*\(.*\)$/, ""))).size, "companies"],
  [projects.length, "projects"],
  [certificates.length, "certificates"],
];
$("#stats").append(...stats.map(([n, label]) => el("div", {}, el("dt", {}, label), el("dd", { "data-count": n }, String(n)))));

const filter = mountWork($("#projects"), projects, projectTags);
const count = $("#proj-count");
const applyFilter = (key) => { const n = filter(key); count.textContent = `${n} project${n === 1 ? "" : "s"}`; };
for (const [key, label] of Object.entries(projectTags)) {
  const b = el("button", { type: "button", class: "chip", "aria-pressed": String(key === "all") }, label);
  b.addEventListener("click", () => { $("#proj-filter").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); applyFilter(key); });
  $("#proj-filter").append(b);
}
applyFilter("all");

const keyhold = projects.find((p) => p.name === "Keyhold");
if (keyhold) mountBuilding($("#building"), keyhold);
else $("#building").hidden = true;

mountCareer($("#career"), experience, education);
const firstStart = Math.min(...experience.map((e) => +e.start.match(/\d{4}/)[0]));
const companies = new Set(experience.map((e) => e.company.replace(/\s*\(.*\)$/, ""))).size;
$("#career-lede").textContent = `${experience.length} roles at ${companies} companies since ${firstStart}, plus the degree that started it. Drag the plug along the cable, click a year, or use the arrow keys.`;

// Screen readers get the skills as plain lists; the canvas is decoration over the same data.
$("#skill-list").append(...Object.entries(skills).map(([k, v]) => el("div", {}, el("h3", {}, k), tagList(v))));
// Education as a row like the experience list: years | degree, school and class | status
$("#edu").append(...education.map((e) => {
  const [degree, ...honours] = e.degree.split(", ");
  return el("div", {}, el("span", { class: "y" }, `${e.start} to ${e.end}`),
    el("div", {}, el("h3", {}, degree), el("div", { class: "o" }, e.school), ...(honours.length ? [el("p", { class: "d" }, honours.join(", "))] : [])),
    el("span", { class: "st" }, "Completed"));
}));
// The thumbnail grid stays hidden; the cards open its macOS-style window.
const certWindow = mountCertViewer($("#cert-viewer"), certificates, "assets/certs/");
mountCerts($("#certs"), certificates, "assets/certs/", certWindow);
$("#certs-lede").textContent = `${certifications.join(" and ")}, and the ${certificates.length} course certificates below. Flip one to see the certificate, then open it full size.`;

// Theme
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved) root.dataset.theme = saved;
else if (matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
$("#theme").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("theme", root.dataset.theme);
});

mountAskTerminal($("#askterm"), {
  run: runCommand,
  suggestions: ["has he done SRE work?", "optibus", "what backend stack does he use?", "does he build mobile apps?", "projects", "contact"],
});

initTerminal();

// Skills toolbox. Each bubble's note says where the skill shows up on this page: in a project's stack
// or write-up first, then in a job's bullet points. Text matches are case-sensitive, so "REST" or "Go"
// don't match "rest" or "go" in a sentence.
const BIN_COLORS = ["#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#be185d", "#15803d"];
const short = (name) => name.replace(/\s*\(.*\)$/, "");
const SKILL_ALIAS = { PHP: "Laravel" }; // a skill that projects list by its framework
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
function usedIn(skill) {
  const s = short(skill), lower = s.toLowerCase();
  const word = new RegExp(`(^|[^A-Za-z0-9])${escRe(s)}($|[^A-Za-z0-9])`);
  // multi-word skills also match when every word's stem appears ("Agent evaluation" ~ "agents ... evaluate")
  const stems = s.includes(" ") ? lower.split(" ").map((w) => w.slice(0, 6)) : null;
  const named = projects.filter((p) => p.stack.some((t) => { const x = t.toLowerCase(); return x === lower || x.startsWith(lower + " ") || lower.startsWith(x + " ") || x === SKILL_ALIAS[s]?.toLowerCase(); })
    || (s.length > 2 && (word.test(p.role) || word.test(p.what)))
    || (stems && stems.every((st) => `${p.what} ${p.role}`.toLowerCase().includes(st)))).map((p) => short(p.name));
  if (named.length) return `Used in ${andList(named.slice(0, 3))}${named.length > 3 ? `, and ${named.length - 3} more` : ""}.`;
  const jobs = [...new Set(experience.filter((e) => s.length > 2 && e.points.some((pt) => word.test(pt))).map((e) => short(e.company)))];
  if (jobs.length) return `Used at ${andList(jobs)}.`;
  return "In my toolkit, though not tied to a project on this page.";
}
const groups = Object.entries(skills).map(([name, list], i) => ({ name, color: BIN_COLORS[i % BIN_COLORS.length], skills: list.map((sk) => [sk, usedIn(sk)]) }));
const total = groups.reduce((n, g) => n + g.skills.length, 0);
const touch = matchMedia("(hover: none)").matches;
$("#tb-lede").textContent = `${groups.length} bins, ${total} tools. ${touch ? "Tap" : "Click"} a bubble to see where I've used it, drag one into another bin, or shake things up.`;
const tip = $("#tb-tip");
const toolbox = mountToolbox($("#tb-canvas"), {
  groups,
  still: matchMedia("(prefers-reduced-motion: reduce)").matches,
  onPick(p) {
    if (!p) { tip.hidden = true; return; }
    const g = groups[p.gi];
    tip.querySelector("b").textContent = p.label;
    tip.querySelector("i").style.background = g.color;
    tip.querySelector("em").textContent = g.name;
    tip.querySelector("p").textContent = p.note;
    tip.style.left = `${Math.min(Math.max(p.x, 150), tip.parentElement.clientWidth - 150)}px`;
    tip.style.top = `${p.y - p.r}px`;
    tip.hidden = false;
  },
});
$("#tb-shake").addEventListener("click", () => toolbox.shake());
$("#tb-tidy").addEventListener("click", () => toolbox.tidy());

// Scroll progress bar under the header's top edge
const bar = $(".progress");
let barQueued = false;
addEventListener("scroll", () => {
  if (barQueued) return;
  barQueued = true;
  requestAnimationFrame(() => {
    barQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  });
}, { passive: true });

// Sound first, so a click that skips the boot screen also unlocks audio for its closing chime.
wireSound($("#sound"));
reveal(document.querySelectorAll("main > section:not(.hero) > :is(.kicker, h2, .lede), #askterm, .work > li, .kh-gate, .kh-vault, #career, .tb, .creds > :is(.sub-k, .sub, .lede), .edu, .cert, .contact-cta"));
runBoot().then(() => document.querySelectorAll("#stats [data-count]").forEach(countUp));
