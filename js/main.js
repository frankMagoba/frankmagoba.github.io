import { profile, experience, projects, skills, education, certifications } from "./content.js";
import { answer, loadSemantic, fallback } from "./ask.js";
import { initTerminal } from "./terminal.js";
import { initHero } from "./hero.js";

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of kids) n.append(c);
  return n;
};
const tagList = (items) => el("ul", { class: "tags" }, ...items.map((t) => el("li", {}, t)));

$("#intro").textContent = profile.intro;
$("#year").textContent = new Date().getFullYear();

$("#projects").append(...projects.map((p) => {
  const links = el("p", { class: "links" }, ...p.links.map(([label, href]) => el("a", { href, rel: "noopener" }, label)));
  if (!p.links.length) links.append(el("span", { class: "muted small" }, "Demo on request"));
  return el("article", { class: "card proj" }, el("h3", {}, p.name), el("span", { class: "where" }, p.where), el("p", {}, p.what), tagList(p.stack), links);
}));

$("#timeline").append(...experience.map((e) => el("li", {},
  el("h3", {}, `${e.role}, ${e.company}`),
  el("span", { class: "meta" }, `${e.start} to ${e.end} · ${e.type}`),
  el("ul", {}, ...e.points.map((p) => el("li", {}, p))))));

$("#skill-list").append(...Object.entries(skills).map(([k, v]) => el("div", {}, el("h3", {}, k), tagList(v))));
$("#edu").textContent = education.map((e) => `${e.degree}, ${e.school}, ${e.start} to ${e.end}`).join("; ");
$("#certs").textContent = certifications.join(", ");

// Theme
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved) root.dataset.theme = saved;
else if (matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
$("#theme").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("theme", root.dataset.theme);
});

// Ask box
const out = $("#ask-out");
$("#ask-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const q = $("#ask-input").value.trim();
  if (!q) return;
  const r = await answer(q);
  out.replaceChildren(r ? el("p", {}, r.text, el("span", { class: "ref" }, `From: ${r.ref}`)) : el("p", {}, fallback));
});
$("#ask-smart").addEventListener("click", async (ev) => {
  ev.target.disabled = true;
  const status = $("#ask-status");
  try { await loadSemantic((s) => (status.textContent = s)); }
  catch { status.textContent = "Couldn't load the model, so keyword search stays on."; ev.target.disabled = false; }
});

initTerminal();
initHero(document.getElementById("mono"));
