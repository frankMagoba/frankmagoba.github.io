// "Built, tested, shipped": every project as a row with its tech stack on the right. Opening one runs a
// short build, test and review pipeline before its details fade in (at once with reduced motion).
// Closing resets it.
import { sound } from "./sound.js";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STAGES = ["Build", "Test", "Review"];

function row(p) {
  const li = document.createElement("li");
  li.dataset.tags = p.tags.join(" ");
  const links = (p.links || []).filter(([, href]) => href);
  li.innerHTML = `<details><summary>
      <span class="w-t"><small>${esc([p.where, p.dates].filter(Boolean).join(" · "))}</small>${esc(p.name)}</span>
      <ul class="w-stack" aria-label="Tech stack">${p.stack.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <span class="w-x" aria-hidden="true"></span>
    </summary>
    <div class="w-b"><div>
      <div class="pipe" aria-hidden="true">${STAGES.map((s) => `<div class="stage"><span>${s}</span><i><b></b></i></div>`).join("")}<em>✓ All checks passed</em></div>
      ${p.brief
        ? `<p class="w-what after">${esc(p.brief)}</p>`
        : `<p class="w-what after">${esc(p.what)}.</p><p class="w-role after">${esc(p.role)}.</p>`}
      ${links.length ? `<p class="links after">${links.map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join("")}</p>` : ""}
      ${p.note ? `<p class="note after">${esc(p.note)}</p>` : ""}
    </div></div></details>`;

  const details = li.querySelector("details"), body = li.querySelector(".w-b"), pipe = li.querySelector(".pipe");
  let timer = 0;
  details.addEventListener("toggle", () => {
    clearTimeout(timer);
    if (!details.open) { pipe.classList.remove("go"); body.classList.remove("done"); return; }
    if (still()) { pipe.classList.add("go"); body.classList.add("done"); return; }
    void pipe.offsetWidth; // restart the bars from empty
    pipe.classList.add("go");
    timer = setTimeout(() => { body.classList.add("done"); sound.play("ship"); }, 1650);
  });
  return li;
}

// Returns a filter function: pass a tag key, or "all".
export function mountWork(list, projects) {
  const rows = projects.map(row);
  list.append(...rows);
  return (key) => {
    for (const li of rows) li.hidden = !(key === "all" || li.dataset.tags.split(" ").includes(key));
  };
}
