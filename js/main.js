import { profile, experience, projects, projectTags, skills, education, certifications, certificates } from "./content.js";
import { mountCertViewer } from "./certviewer.js";
import { initTerminal, runCommand } from "./terminal.js";
import { mountAskTerminal } from "./askterm.js";

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

const cards = projects.map((p) => {
  const realLinks = (p.links || []).filter(([, href]) => href);
  const card = el("article", { class: "card proj", "data-tags": p.tags.join(" ") },
    el("div", { class: "proj-head" }, el("h3", {}, p.name), el("span", { class: "where" }, [p.where, p.dates].filter(Boolean).join(" · "))),
    el("p", { class: "pwhat" }, p.what + "."),
    el("p", { class: "pwork" }, p.role + "."),
    tagList(p.stack));
  if (realLinks.length) {
    card.append(el("p", { class: "links" }, ...realLinks.map(([label, href]) =>
      el("a", { href, target: "_blank", rel: "noopener noreferrer" }, label))));
  }
  if (p.note) card.append(el("p", { class: "note" }, p.note));
  return card;
});
$("#projects").append(...cards);
const count = $("#proj-count");
const filter = (key) => {
  let n = 0;
  for (const c of cards) { const show = key === "all" || c.dataset.tags.split(" ").includes(key); c.hidden = !show; n += show; }
  count.textContent = `${n} project${n === 1 ? "" : "s"}`;
};
for (const [key, label] of Object.entries(projectTags)) {
  const b = el("button", { type: "button", class: "chip", "aria-pressed": String(key === "all") }, label);
  b.addEventListener("click", () => { $("#proj-filter").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); filter(key); });
  $("#proj-filter").append(b);
}
filter("all");

$("#timeline").append(...experience.map((e) => el("li", {},
  el("h3", {}, `${e.role}, ${e.company}`),
  el("span", { class: "meta" }, `${e.start} to ${e.end} · ${e.type}`),
  el("ul", {}, ...e.points.map((p) => el("li", {}, p))))));

$("#skill-list").append(...Object.entries(skills).map(([k, v]) => el("div", {}, el("h3", {}, k), tagList(v))));
$("#edu").textContent = education.map((e) => `${e.degree}, ${e.school}, ${e.start} to ${e.end}`).join("; ");
$("#certs").innerHTML = `${certifications.join(", ")}. <a href="https://www.hackerrank.com/profile/franklinmagoba4" rel="noopener">HackerRank profile</a>.`;
mountCertViewer($("#cert-viewer"), certificates, "assets/certs/");

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
