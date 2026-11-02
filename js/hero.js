// The opening: a laptop on the right whose lock screen carries the visitor's own clock and my name.
// Scrolling through the hero plays it forwards, and scrolling back plays it in reverse, because every
// state is a function of the scroll position p (0..1): the cable plugs in, the password types itself,
// the Mac unlocks and a terminal says who I am. Drag the laptop to spin it; click the screen to jump
// to signing in.
import { sound } from "./sound.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const span = (p, a, b) => clamp((p - a) / (b - a));
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

// Scroll beats, as fractions of the hero
const PLUG = [0.02, 0.18], TYPE = [0.3, 0.52], UNLOCK = 0.58, TERM = [0.62, 0.95], DOTS = 8;

export function mountHero(root, { name, title, location, years, projects }) {
  const stage = root.querySelector(".lt-stage"), pin = root.querySelector(".hero-pin");
  const plug = root.querySelector(".lt-plug"), dots = root.querySelector(".pw-dots");
  const term = root.querySelector(".term-body"), cue = root.querySelector(".hero-cue");
  root.querySelector("[data-years]").textContent = WORDS[years] || String(years);
  root.querySelector(".lock .who").textContent = name;
  root.querySelector(".lock .av").textContent = name.split(" ").map((w) => w[0]).join("");
  dots.innerHTML = "<i></i>".repeat(DOTS);
  const dotEls = [...dots.children];

  // The terminal's script, typed out in step with the scroll.
  const user = name.split(" ")[0].toLowerCase();
  const lines = [
    [`${user}@macbook ~ % `, "whoami"],
    ["", `${name} · ${title} · ${location.split(",")[0]}`],
    [`${user}@macbook ~ % `, "ls ~/work"],
    ["", `${projects.slice(0, 5).join("  ")}  +${projects.length - 5} more`],
    [`${user}@macbook ~ % `, "open portfolio"],
  ];
  const total = lines.reduce((n, [, t]) => n + t.length, 0);

  // ---- the clock on the lock screen and menu bar: the visitor's own time ----
  const clockEls = root.querySelectorAll("[data-clock]"), dateEl = root.querySelector("[data-date]");
  const tick = () => {
    const now = new Date();
    const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    clockEls.forEach((el) => { el.textContent = hm; });
    dateEl.textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  };
  tick();
  setInterval(tick, 15000);

  // ---- scroll → state ----
  let spin = 0, last = { plugged: false, unlocked: false, typed: 0 };
  const progress = () => {
    const r = root.getBoundingClientRect();
    // pinned (wide screens): the hero is taller than the viewport and the laptop holds still while it scrolls
    if (getComputedStyle(pin).position === "sticky") return clamp(-r.top / Math.max(1, r.height - innerHeight));
    return clamp(-r.top / Math.max(1, r.height * 0.85));
  };

  function render() {
    const p = progress(), e = ease(p);
    // turning past about -14deg swings the cable across the text column, so the turn stops there
    stage.style.setProperty("--rz", `${clamp(lerp(-36, -20, e) + spin, -85, -14).toFixed(2)}deg`);
    stage.style.setProperty("--tilt", `${lerp(58, 53, e).toFixed(2)}deg`);
    stage.style.setProperty("--zoom", lerp(0.95, 1, e).toFixed(3));

    const plugT = ease(span(p, ...PLUG));
    plug.style.setProperty("--in", plugT.toFixed(3));
    const plugged = plugT >= 0.999;
    stage.classList.toggle("plugged", plugged);
    if (plugged && !last.plugged) sound.play("plug");

    const typed = Math.floor(span(p, ...TYPE) * DOTS + 0.0001);
    dotEls.forEach((d, i) => d.classList.toggle("on", i < typed));
    stage.classList.toggle("typing", typed > 0);
    if (typed > last.typed) sound.play("key");

    const unlocked = p >= UNLOCK;
    stage.classList.toggle("unlocked", unlocked);
    if (unlocked && !last.unlocked) sound.play("unlock");

    // type the terminal up to this many characters, line by line
    let budget = Math.round(span(p, ...TERM) * total), html = "";
    for (const [prompt, text] of lines) {
      if (budget <= 0 && html) break;
      const shown = text.slice(0, Math.max(0, budget));
      budget -= text.length;
      html += `<div>${prompt ? `<span class="ps">${prompt}</span>` : ""}${shown.replace(/&/g, "&amp;").replace(/</g, "&lt;")}${budget < 0 ? '<span class="caret"></span>' : ""}</div>`;
    }
    term.innerHTML = html || `<div><span class="ps">${lines[0][0]}</span><span class="caret"></span></div>`;

    cue.style.setProperty("--p", p.toFixed(3));
    cue.classList.toggle("gone", p > 0.9);
    last = { plugged, unlocked, typed };
  }

  const header = document.querySelector(".top");
  const sizeHeader = () => document.documentElement.style.setProperty("--hdr", `${header.offsetHeight}px`);
  sizeHeader();
  addEventListener("resize", sizeHeader);

  let queued = false;
  // once per frame; a hidden tab gets no frames, so it renders straight away instead
  const schedule = () => {
    if (document.hidden) return render();
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); }
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  render();

  // ---- drag to spin, click to sign in ----
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, spin, moved: false, id: e.pointerId };
    try { stage.setPointerCapture(e.pointerId); } catch {}
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { drag.moved = true; stage.classList.add("spinning"); }
    if (drag.moved) { spin = clamp(drag.spin + dx * 0.3, -60, 25); render(); }
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDrag = drag.moved;
    drag = null;
    stage.classList.remove("spinning");
    if (wasDrag || stage.classList.contains("unlocked")) return;
    // a click: scroll to just past the unlock, so the page and the laptop stay in step
    const r = root.getBoundingClientRect(), sticky = getComputedStyle(pin).position === "sticky";
    const range = sticky ? r.height - innerHeight : r.height * 0.85;
    scrollTo({ top: scrollY + r.top + range * (UNLOCK + 0.1), behavior: "smooth" });
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
}
