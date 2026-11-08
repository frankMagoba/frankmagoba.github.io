// Certificates as cards that tilt towards the cursor and flip over with a little pop. The front has a
// seal, the title and the issuer; the back shows the certificate itself, with a button that opens it
// full size in the certificate window (certviewer.js). The face turned away is inert, so Tab skips it.
import { sound } from "./sound.js";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FILLER = new Set(["a", "an", "and", "the", "of", "to", "microsoft", "azure", "exam", "prep", "learning"]);

// The seal reads like an exam code: "(AZ-900)" -> "AZ 900", otherwise up to three initials of the topic.
function seal(title) {
  const code = title.match(/\(([A-Z]{2,3})-(\d{2,3})\)/);
  if (code) return `${code[1]}<br>${code[2]}`;
  const words = title.replace(/\(.*?\)/g, "").split(/[\s:,]+/).filter((w) => w && !FILLER.has(w.toLowerCase()));
  return words.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
}

export function mountCerts(root, certs, base, viewer) {
  root.innerHTML = certs.map((c, i) => `
    <div class="cert" data-i="${i}">
      <div class="cert-in">
        <button type="button" class="face front" aria-label="${esc(c.title)}. Flip to see the certificate.">
          <span class="seal" aria-hidden="true">${seal(c.title)}</span>
          <b>${esc(c.title)}</b>
          <span class="m">${esc([c.issuer, c.date].filter(Boolean).join(" · "))}</span>
          <span class="hint" aria-hidden="true">Flip ↻</span>
        </button>
        <div class="face back" inert>
          <img src="${base}${c.file}-thumb.webp" alt="" loading="lazy" decoding="async"${c.bg ? ` style="background:${esc(c.bg)}"` : ""} width="480" height="${c.file === "alc-badge" ? 270 : 371}">
          <div class="acts"><button type="button" class="pill-btn open">Open ↗</button><button type="button" class="pill-btn back-btn">Flip back ↺</button></div>
        </div>
      </div>
    </div>`).join("");

  for (const card of root.querySelectorAll(".cert")) {
    const inner = card.querySelector(".cert-in"), front = card.querySelector(".front"), back = card.querySelector(".back");
    const flip = (on) => {
      card.classList.toggle("flipped", on);
      front.inert = on; back.inert = !on;
      (on ? back.querySelector(".open") : front).focus({ preventScroll: true });
      if (!still()) { card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop"); }
      sound.play("flip");
    };
    front.addEventListener("click", () => flip(true));
    back.querySelector(".back-btn").addEventListener("click", () => flip(false));
    back.querySelector(".open").addEventListener("click", (e) => viewer.open(+card.dataset.i, e.currentTarget));
    card.addEventListener("animationend", () => card.classList.remove("pop"));

    // tilt towards the cursor, and move the shine with it (mouse only)
    card.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || still()) return;
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      inner.classList.add("tilting");
      inner.style.setProperty("--rx", `${((0.5 - py) * 12).toFixed(2)}deg`);
      inner.style.setProperty("--ry", `${((px - 0.5) * 16).toFixed(2)}deg`);
      inner.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      inner.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => { inner.classList.remove("tilting"); inner.style.setProperty("--rx", "0deg"); inner.style.setProperty("--ry", "0deg"); });
  }
}
